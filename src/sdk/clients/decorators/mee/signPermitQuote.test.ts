import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  getContract,
  isHex,
  keccak256,
  parseUnits,
  toBytes,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { arbitrum, polygon } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  MAINNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import {
  type NetworkConfig,
  getAllowance,
  getBalance,
  setAllowance
} from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import {
  DEFAULT_MEE_VERSION,
  PERMIT_TYPEHASH,
  TokenWithPermitAbi
} from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { AnyData, getMEEVersion } from "../../../modules"
import {
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkApiKey,
  getDefaultMEENetworkUrl
} from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import getFusionQuote from "./getFusionQuote"
import getPermitQuote from "./getPermitQuote"
import type { FeeTokenInfo } from "./getQuote"
import { type QuoteType, getQuoteType } from "./getQuoteType"
import signOnChainQuote from "./signOnChainQuote"
import {
  type MultichainSmartAccountParams,
  type TokenTrigger,
  type Trigger,
  formatSignedPermitQuotePayload,
  prepareSignablePermitQuotePayload,
  signPermitQuote
} from "./signPermitQuote"
import { getMeeVersionsForQuote } from "./signQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runPaidTests, runLifecycleTests } = inject("settings")

describe("mee.signPermitQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let tokenAddress: Address

  let recipientAccount: LocalAccount

  const index = 89n // Randomly chosen index

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)

    eoaAccount = network.account!
    recipientAccount = privateKeyToAccount(generatePrivateKey())
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ],
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  const buildAccountParams = (
    account: MultichainSmartAccount,
    fusionQuote: {
      quote: { paymentInfo: { sponsored: boolean }; userOps: AnyData[] }
      trigger: { chainId: number }
    }
  ): MultichainSmartAccountParams => {
    const { trigger } = fusionQuote
    const deployment = account.deploymentOn(trigger.chainId, true)
    const startIndex = fusionQuote.quote.paymentInfo.sponsored ? 1 : 0
    return {
      owner: account.signer.address,
      spender: deployment.address,
      walletClient: deployment.walletClient,
      meeVersions: getMeeVersionsForQuote(
        account,
        fusionQuote.quote.userOps.slice(startIndex)
      )
    }
  }

  test.concurrent("should check permitTypehash is correct", async () => {
    const permitTypehash = keccak256(
      toBytes(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      )
    )
    expect(permitTypehash).toBe(PERMIT_TYPEHASH)
  })

  test.concurrent("should check domainSeparator is correct", async () => {
    const expectedDomainSeparatorForOptimism =
      "0x26d9c34bb1a1c312f69c53b2d93b8be20faafba63af2438c6811713c9b1f933f"

    const domainSeparator = await getContract({
      address: mcUSDC.addressOn(paymentChain.id),
      abi: TokenWithPermitAbi,
      client: mcNexus.deploymentOn(paymentChain.id, true).client
    }).read.DOMAIN_SEPARATOR()

    expect(domainSeparator).toBe(expectedDomainSeparatorForOptimism)
  })

  test("should sign a quote using signPermitQuote", async () => {
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger: {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    const {
      fallbackToOnchainMode,
      signedPermitQuotePayload: signedPermitQuote
    } = await signPermitQuote({
      fusionQuote,
      account: buildAccountParams(mcNexus, fusionQuote)
    })

    if (fallbackToOnchainMode) {
      // This always fails here. This is being coded like this to avoid type issues
      expect(fallbackToOnchainMode).to.be.eq(false)
      return
    }

    expect(signedPermitQuote).toBeDefined()
  })

  test.runIf(runPaidTests)(
    "should execute a signed fusion quote using signPermitQuote",
    async () => {
      console.time("signPermitQuote:getQuote")
      console.time("signPermitQuote:getHash")
      console.time("signPermitQuote:receipt")

      const trigger = {
        chainId: paymentChain.id,
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n
      }

      const fusionQuote = await getPermitQuote(meeClient, {
        trigger,
        instructions: [
          mcNexus.build({
            type: "transfer",
            data: {
              tokenAddress: trigger.tokenAddress,
              chainId: trigger.chainId,
              amount: 1n,
              recipient: recipientAccount.address
            }
          })
        ],
        feeToken
      })

      console.timeEnd("signPermitQuote:getQuote")
      expect(fusionQuote.quote.quoteType).toBe("permit")

      const { fallbackToOnchainMode, signedPermitQuotePayload: signedQuote } =
        await signPermitQuote({
          fusionQuote,
          account: buildAccountParams(mcNexus, fusionQuote)
        })

      if (fallbackToOnchainMode) {
        // This always fails here. This is being coded like this to avoid type issues
        expect(fallbackToOnchainMode).to.be.eq(false)
        return
      }

      const meeVersions = getMeeVersionsForQuote(
        mcNexus,
        fusionQuote.quote.userOps
      )
      const signedQuoteFull = {
        ...signedQuote,
        meeVersions,
        isEIP712TrustedSponsorshipSupported: true
      }

      const { hash } = await executeSignedQuote(meeClient, {
        signedQuote: signedQuoteFull
      })
      console.timeEnd("signPermitQuote:getHash")
      const receipt = await waitForSupertransactionReceipt(meeClient, {
        confirmations: TEST_BLOCK_CONFIRMATIONS,
        hash
      })
      console.timeEnd("signPermitQuote:receipt")

      expect(receipt).toBeDefined()
      console.log(receipt.explorerLinks)
      const balanceOfRecipient = await getBalance(
        mcNexus.deploymentOn(paymentChain.id, true).publicClient,
        recipientAccount.address,
        tokenAddress
      )
      expect(balanceOfRecipient).toBe(trigger.amount)
    }
  )
})

describe.runIf(runLifecycleTests)("mee.signPermitQuote - testnet", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let chain: Chain

  let walletClient: WalletClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: 1n,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })
    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZhZhHx3hmKrBQxacr283dHt"
    })
  })

  const buildAccountParams = (
    account: MultichainSmartAccount,
    fusionQuote: {
      quote: { paymentInfo: { sponsored: boolean }; userOps: AnyData[] }
      trigger: { chainId: number }
    }
  ): MultichainSmartAccountParams => {
    const { trigger } = fusionQuote
    const deployment = account.deploymentOn(trigger.chainId, true)
    const startIndex = fusionQuote.quote.paymentInfo.sponsored ? 1 : 0
    return {
      owner: account.signer.address,
      spender: deployment.address,
      walletClient: deployment.walletClient,
      meeVersions: getMeeVersionsForQuote(
        account,
        fusionQuote.quote.userOps.slice(startIndex)
      )
    }
  }

  describe("custom approvalAmount", () => {
    test("should fail if approvalAmount is smaller than the trigger amount", async () => {
      const amount = parseUnits("0.01", 6)
      const approvalAmount = parseUnits("0.005", 6)
      const token = testnetMcTestUSDCP.addressOn(network.chain.id)
      const trigger: Trigger = {
        chainId: network.chain.id,
        tokenAddress: token,
        amount,
        approvalAmount
      }
      const fusionQuote = await meeClient.getOnChainQuote({
        trigger,
        instructions: [
          await mcNexus.build({
            type: "transfer",
            data: {
              // transfer back to the eoa account
              recipient: mcNexus.signer.address,
              tokenAddress: token,
              amount: 1n,
              chainId: network.chain.id
            }
          })
        ],
        feeToken: {
          chainId: network.chain.id,
          address: token
        }
      })
      expect(fusionQuote).toBeDefined()
      expect(fusionQuote.trigger).toBeDefined()
      await expect(
        meeClient.executeFusionQuote({
          fusionQuote
        })
      ).rejects.toThrow()
    })
    test("changes the allowance based on approvalAmount", async () => {
      // Define the amount to transfer and the custom approval amount (allowance)
      const amount = parseUnits("0.01", 6)
      const approvalAmount = parseUnits("0.06", 6)
      const token = testnetMcTestUSDCP.addressOn(chain.id)
      // Create a wallet client for sending transactions and a public client for reading blockchain state
      const walletClient = createWalletClient({
        account: eoaAccount,
        chain: network.chain,
        transport: http(network.rpcUrl)
      })
      const publicClient = createPublicClient({
        chain: network.chain,
        transport: http(network.rpcUrl)
      })
      // Set the allowance to 0 before the test to ensure a known state (reset approval)
      await setAllowance({
        publicClient,
        walletClient,
        tokenAddress: token,
        spender: mcNexus.addressOn(chain.id, true),
        amount: 0n
      })
      // Read the starting allowance (should be 0)
      const allowanceStart = await getAllowance({
        publicClient,
        tokenAddress: token,
        owner: mcNexus.signer.address,
        spender: mcNexus.addressOn(chain.id, true)
      })
      expect(allowanceStart).toBe(0n)

      // Prepare the trigger with the custom approvalAmount
      const trigger: Trigger = {
        chainId: chain.id,
        tokenAddress: token,
        amount, // The amount to transfer
        approvalAmount // The custom allowance to set
      }

      const fusionQuote = await meeClient.getOnChainQuote({
        trigger,
        instructions: [
          await mcNexus.build({
            type: "transfer",
            data: {
              // transfer back to the eoa account
              recipient: mcNexus.signer.address,
              tokenAddress: token,
              amount: 1n,
              chainId: chain.id
            }
          })
        ],
        feeToken: {
          chainId: chain.id,
          address: token
        }
      })
      expect(fusionQuote).toBeDefined()
      expect(fusionQuote.trigger).toBeDefined()
      // // Execute the quote
      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote
      })

      // Wait for the transaction to complete
      const executeReceipt = await meeClient.waitForSupertransactionReceipt({
        hash
      })
      expect(executeReceipt.transactionStatus).toBe("MINED_SUCCESS")
      // Read the ending allowance (should match approvalAmount - the amount that was spent on fees and the amount that was transferred)
      const allowanceEnd = await getAllowance({
        publicClient,
        tokenAddress: token,
        owner: mcNexus.signer.address,
        spender: mcNexus.addressOn(chain.id, true)
      })
      const fees = BigInt(executeReceipt.paymentInfo?.tokenWeiAmount ?? 0n)
      expect(allowanceEnd).toBe(approvalAmount - amount - fees)
    })
  })

  test("should sign a quote using signPermitQuote with modular signing functions", async () => {
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger: {
        chainId: chain.id,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: chain.id
          }
        })
      ],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    })

    const {
      fallbackToOnchainMode,
      signedPermitQuotePayload: signedPermitQuote
    } = await signPermitQuote({
      fusionQuote,
      account: buildAccountParams(mcNexus, fusionQuote)
    })

    if (fallbackToOnchainMode) {
      // This always fails here. This is being coded like this to avoid type issues
      expect(fallbackToOnchainMode).to.be.eq(false)
      return
    }

    expect(signedPermitQuote).toBeDefined()
    expect(signedPermitQuote.signature).toBeDefined()

    expect(isHex(signedPermitQuote.signature)).toEqual(true)

    const quoteType = await getQuoteType(meeClient, fusionQuote)

    expect(quoteType).toEqual("permit")

    const {
      fallbackToOnchainMode: isFallbackNeeded,
      signablePayload,
      metadata
    } = await prepareSignablePermitQuotePayload(
      fusionQuote,
      eoaAccount.address,
      mcNexus.addressOn(chain.id, true),
      walletClient
    )

    if (isFallbackNeeded) {
      // This always fails here. This is being coded like this to avoid type issues
      expect(isFallbackNeeded).to.be.eq(false)
      return
    }

    const signature = await walletClient.signTypedData({
      ...signablePayload,
      account: walletClient.account!
    })

    const accountParams = buildAccountParams(mcNexus, fusionQuote)
    const manuallySignedPermitQuote = formatSignedPermitQuotePayload(
      accountParams.meeVersions,
      fusionQuote,
      metadata,
      signature
    )

    expect(manuallySignedPermitQuote).toBeDefined()
    expect(manuallySignedPermitQuote.signature).toBeDefined()
    expect(isHex(manuallySignedPermitQuote.signature)).toEqual(true)

    expect(signedPermitQuote.signature).toEqual(
      manuallySignedPermitQuote.signature
    )
  })

  test("Should generate a proper valid domain separator for exotic tokens with different EIP712 domain types", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: arbitrum,
          transport: http(MAINNET_RPC_URLS[arbitrum.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: polygon,
          transport: http(MAINNET_RPC_URLS[polygon.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: getDefaultMEENetworkApiKey(),
      url: getDefaultMEENetworkUrl()
    })

    const tokensWithChainId = [
      {
        tokenAddress: "0x09199d9A5F4448D0848e4395D065e1ad9c4a1F74" as Address, // Bonk token
        chainId: arbitrum.id
      },
      {
        tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as Address, // Polygon USDC token
        chainId: polygon.id
      }
    ]

    for (const { tokenAddress, chainId } of tokensWithChainId) {
      const fusionQuote = await getFusionQuote(meeClient, {
        trigger: {
          chainId: chainId,
          tokenAddress: tokenAddress,
          amount: 1n
        },
        instructions: [
          mcNexus.build({
            type: "default",
            data: {
              calls: [
                {
                  to: zeroAddress,
                  value: 0n
                }
              ],
              chainId: chainId
            }
          })
        ],
        feeToken: {
          chainId: chainId,
          address: tokenAddress
        }
      })

      const { fallbackToOnchainMode } = await prepareSignablePermitQuotePayload(
        fusionQuote,
        eoaAccount.address,
        mcNexus.addressOn(chainId, true),
        mcNexus.deploymentOn(chainId, true).walletClient
      )

      // This will be undefined if the permit values are proper
      expect(fallbackToOnchainMode).to.be.eq(undefined)
    }
  })

  test("prepareSignablePermitQuotePayload should indicate fallbackToOnchainMode when the permit values are invalid", async () => {
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger: {
        chainId: chain.id,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: chain.id
          }
        })
      ],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    })

    const modifiedFusionQuote = {
      ...fusionQuote,
      trigger: {
        ...(fusionQuote.trigger as TokenTrigger),
        tokenAddress: zeroAddress // Forcefully adding a non permit supported address to trigger fallback flow
      }
    }

    const { fallbackToOnchainMode, signedPermitQuotePayload } =
      await signPermitQuote({
        fusionQuote: modifiedFusionQuote,
        account: buildAccountParams(mcNexus, modifiedFusionQuote)
      })

    expect(fallbackToOnchainMode).to.be.eq(true)
    expect(signedPermitQuotePayload).to.be.eq(undefined)
  })

  test("Permit should fallback to on-chain mode when the permit values are invalid", async () => {
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger: {
        chainId: chain.id,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: chain.id
          }
        })
      ],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    })

    const modifiedFusionQuote = {
      ...fusionQuote,
      trigger: {
        ...(fusionQuote.trigger as TokenTrigger),
        tokenAddress: zeroAddress // Forcefully adding a non permit supported address to trigger fallback flow
      }
    }

    const { fallbackToOnchainMode, signedPermitQuotePayload } =
      await signPermitQuote({
        fusionQuote: modifiedFusionQuote,
        account: buildAccountParams(mcNexus, modifiedFusionQuote)
      })

    expect(fallbackToOnchainMode).to.be.eq(true)
    expect(signedPermitQuotePayload).to.be.eq(undefined)

    let trigger: TokenTrigger | undefined = undefined

    // If there is no call, it is always TokenTrigger
    if (fusionQuote.trigger && !fusionQuote.trigger.call) {
      trigger = fusionQuote.trigger
    }

    const signedQuote = await signOnChainQuote(meeClient, { fusionQuote })

    // add the required fields for the signed quote
    // in the wild we always use signFusionQuote wrapper that adds these fields
    const meeVersions = getMeeVersionsForQuote(
      mcNexus,
      fusionQuote.quote.userOps
    )
    const signedQuoteFull = {
      ...signedQuote,
      meeVersions,
      isEIP712TrustedSponsorshipSupported: true,
      quoteType: "onchain" as QuoteType // If fallbackToOnchainMode is true, the quote type is onchain
      // and this type should be forced when sending a quote to the execution
    }

    // Execute the quote
    const { hash } = await executeSignedQuote(meeClient, {
      signedQuote: {
        ...signedQuoteFull,
        trigger
      }
    })

    // Wait for the transaction to complete
    const executeReceipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    expect(executeReceipt.transactionStatus).toBe("MINED_SUCCESS")
    console.log({
      explorerLinks: executeReceipt.explorerLinks,
      hash: executeReceipt.hash
    })
  })
})
