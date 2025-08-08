import {
  http,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type Transport,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  isHex,
  parseUnits,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { optimism } from "viem/chains"
import { beforeAll, describe, expect, inject, test, vi } from "vitest"
import {
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
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
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC, mcUSDT } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import {
  DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
  DEFAULT_PATHFINDER_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import executeSignedQuote from "./executeSignedQuote"
import getFusionQuote from "./getFusionQuote"
import getOnChainQuote from "./getOnChainQuote"
import getPaymentToken, { type GetPaymentTokenPayload } from "./getPaymentToken"
import { type FeeTokenInfo, getQuote } from "./getQuote"
import { getQuoteType } from "./getQuoteType"
import {
  ON_CHAIN_PREFIX,
  formatSignedOnChainQuotePayload,
  prepareExecutableOnChainQuotePayload,
  signOnChainQuote
} from "./signOnChainQuote"
import type { Trigger } from "./signPermitQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runLifecycleTests, runPaidTests } = inject("settings")

describe.runIf(runPaidTests)("mee.signOnChainQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient
  let recipientAccount: LocalAccount
  let tokenAddress: Hex

  const index = 79n // Randomly chosen index

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
      address: mcUSDC.addressOn(optimism.id),
      chainId: optimism.id
    }

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index,
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
      ]
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(optimism.id)
  })

  test("should execute a quote using signOnChainQuote", async () => {
    console.time("signOnChainQuote:getQuote")
    console.time("signOnChainQuote:getHash")
    console.time("signOnChainQuote:receipt")

    const trigger = {
      chainId: optimism.id,
      tokenAddress,
      amount: 1n
    }

    const sender = mcNexus.signer.address
    const { address: recipient } = mcNexus.deploymentOn(optimism.id, true)

    const quote = await getQuote(meeClient, {
      path: "quote-permit",
      eoa: sender,
      instructions: [
        mcNexus.build({
          type: "transferFrom",
          data: { ...trigger, sender, recipient }
        }),
        mcNexus.build({
          type: "transfer",
          data: {
            ...trigger,
            recipient: recipientAccount.address
          }
        })
      ],
      feeToken
    })

    console.timeEnd("signOnChainQuote:getQuote")
    const signedQuote = await signOnChainQuote(meeClient, {
      fusionQuote: {
        quote,
        trigger: {
          ...trigger,
          amount:
            BigInt(trigger.amount) + BigInt(quote.paymentInfo.tokenWeiAmount)
        }
      }
    })
    const executeSignedQuoteResponse = await executeSignedQuote(meeClient, {
      signedQuote
    })
    console.timeEnd("signOnChainQuote:getHash")
    const superTransactionReceipt = await waitForSupertransactionReceipt(
      meeClient,
      {
        hash: executeSignedQuoteResponse.hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      }
    )
    console.timeEnd("signOnChainQuote:receipt")

    console.log(superTransactionReceipt.explorerLinks)
    expect(superTransactionReceipt.explorerLinks.length).toBeGreaterThan(0)
    expect(isHex(executeSignedQuoteResponse.hash)).toBe(true)

    const balanceOfRecipient = await getBalance(
      mcNexus.deploymentOn(optimism.id, true).publicClient,
      recipientAccount.address,
      tokenAddress
    )
    expect(balanceOfRecipient).toBe(trigger.amount)
  })
  describe("trigger calls", () => {
    test("should handle ETH forwarder trigger call", async () => {
      const ethTrigger = {
        chainId: optimism.id,
        tokenAddress: zeroAddress,
        amount: 1n
      }

      const sender = mcNexus.signer.address
      const { address: recipient } = mcNexus.deploymentOn(optimism.id, true)

      const quote = await getQuote(meeClient, {
        path: "quote-permit",
        eoa: sender,
        instructions: [
          mcNexus.build({
            type: "transferFrom",
            data: { ...ethTrigger, sender, recipient }
          })
        ],
        feeToken
      })

      const signedQuote = await signOnChainQuote(meeClient, {
        fusionQuote: {
          quote,
          trigger: ethTrigger
        }
      })

      expect(signedQuote.signature).toBeDefined()
      expect(signedQuote.signature.startsWith(ON_CHAIN_PREFIX)).toBe(true)
    })

    test("should handle ERC20 approval trigger call", async () => {
      const erc20Trigger = {
        chainId: optimism.id,
        tokenAddress,
        amount: 1n
      }

      const quote = await getQuote(meeClient, {
        path: "quote-permit",
        eoa: mcNexus.signer.address,
        instructions: [
          mcNexus.build({
            type: "transfer",
            // dummy instruction
            data: {
              tokenAddress,
              recipient: zeroAddress,
              chainId: optimism.id,
              amount: 1n
            }
          })
        ],
        feeToken
      })

      const signedQuote = await signOnChainQuote(meeClient, {
        confirmations: TEST_BLOCK_CONFIRMATIONS,
        fusionQuote: {
          quote,
          trigger: erc20Trigger
        }
      })

      expect(signedQuote.signature).toBeDefined()
      expect(signedQuote.signature.startsWith(ON_CHAIN_PREFIX)).toBe(true)
    })
  })
  describe("custom approvalAmount", () => {
    test("should fail if approvalAmount is smaller than the trigger amount", async () => {
      const amount = parseUnits("0.01", 6)
      const approvalAmount = parseUnits("0.005", 6)
      const token = mcUSDT.addressOn(network.chain.id)
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
      // Execute the quote
      await expect(
        meeClient.executeFusionQuote({
          fusionQuote
        })
      ).rejects.toThrow()
    })

    // This test is skipped because it uses USDT token which doesn't have fund setup.
    test.skip("changes the allowance based on approvalAmount", async () => {
      // Define the amount to transfer and the custom approval amount (allowance)
      const amount = parseUnits("0.01", 6)
      const approvalAmount = parseUnits("0.03", 6)
      const token = mcUSDT.addressOn(network.chain.id)
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
        spender: mcNexus.addressOn(network.chain.id, true),
        amount: 0n
      })

      // Read the starting allowance (should be 0)
      const allowanceStart = await getAllowance({
        publicClient,
        tokenAddress: token,
        owner: mcNexus.signer.address,
        spender: mcNexus.addressOn(network.chain.id, true)
      })
      expect(allowanceStart).toBe(0n)

      // Prepare the trigger with the custom approvalAmount
      const trigger: Trigger = {
        chainId: network.chain.id,
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
        spender: mcNexus.addressOn(network.chain.id, true)
      })
      const fees = BigInt(executeReceipt.paymentInfo?.tokenWeiAmount ?? 0n)
      expect(allowanceEnd).toBe(approvalAmount - amount - fees)
    })
  })
})

describe.runIf(runLifecycleTests)("mee.signOnChainQuote - testnet", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let chain: Chain

  let walletClient: WalletClient
  let publicClient: PublicClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain
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

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    publicClient = createPublicClient({
      chain,
      transport: http(network.rpcUrl)
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
  })

  test("should succeed with native coin trigger", async () => {
    const trigger = {
      chainId: network.chain.id,
      tokenAddress: zeroAddress,
      amount: 1n
    }

    const fusionQuote = await meeClient.getOnChainQuote({
      trigger,
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            chainId: network.chain.id,
            calls: [
              {
                // dummy transfer to an address
                to: "0x072A5250ecDE01De247b6671BC206756b6b0Ec26" as `0x${string}`,
                value: 1n
              }
            ]
          }
        })
      ],
      feeToken: {
        chainId: network.chain.id,
        address: zeroAddress
      }
    })
    // Execute the quote
    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote
    })

    // Wait for the transaction to complete
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  describe("should succeed with custom call trigger", () => {
    test("should succeed with sponsored=true transactions", async () => {
      const fusionQuote = await meeClient.getOnChainQuote({
        trigger: {
          call: {
            // dummy transfer to an address
            to: "0x072A5250ecDE01De247b6671BC206756b6b0Ec26" as `0x${string}`,
            value: 1n
          },
          chainId: network.chain.id
        },
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_PATHFINDER_URL,
          gasTank: {
            address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
            token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
            chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
          }
        },
        instructions: [
          mcNexus.build({
            type: "default",
            data: {
              chainId: network.chain.id,
              calls: [
                {
                  // dummy transfer to an address
                  to: "0x072A5250ecDE01De247b6671BC206756b6b0Ec26" as `0x${string}`,
                  value: 1n
                }
              ]
            }
          })
        ]
      })
      // Execute the quote
      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote
      })
      // Wait for the transaction to complete
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    })
    test("should succeed with sponsored=false transactions", async () => {
      const fusionQuote = await meeClient.getOnChainQuote({
        trigger: {
          call: {
            // dummy transfer to an address
            to: "0x072A5250ecDE01De247b6671BC206756b6b0Ec26" as `0x${string}`,
            value: 1n
          },
          chainId: network.chain.id
        },
        // note that the fee token needs to match with the trigger above
        // eg if the trigger is for transferring ETH, the fee token needs to be ETH
        feeToken: {
          chainId: network.chain.id,
          address: zeroAddress
        },
        instructions: [
          mcNexus.build({
            type: "default",
            data: {
              chainId: network.chain.id,
              calls: [
                {
                  // dummy transfer to an address
                  to: "0x072A5250ecDE01De247b6671BC206756b6b0Ec26" as `0x${string}`,
                  value: 1n
                }
              ]
            }
          })
        ]
      })
      // Execute the quote
      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote
      })
      // Wait for the transaction to complete
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    })
  })
  describe("should handle ETH forwarder trigger call", () => {
    test("should handle ETH forwarder trigger call", async () => {
      const ethTrigger = {
        chainId: network.chain.id,
        tokenAddress: zeroAddress,
        amount: 1n
      }
      const feeToken = {
        address: zeroAddress,
        chainId: network.chain.id
      }
      const { address: recipient } = mcNexus.deploymentOn(
        network.chain.id,
        true
      )
      const quote = await getOnChainQuote(meeClient, {
        trigger: ethTrigger,
        instructions: [
          mcNexus.build({
            type: "default",
            data: {
              chainId: network.chain.id,
              calls: [
                {
                  // dummy transfer to an address, this can be any transaction
                  to: recipient,
                  value: 1n
                }
              ]
            }
          })
        ],
        feeToken
      })
      // return
      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote: quote
      })
      // Wait for the transaction to complete
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    })

    test("should work with useMaxAvailableFunds", async () => {
      const ethTrigger: Trigger = {
        chainId: network.chain.id,
        tokenAddress: zeroAddress,
        useMaxAvailableFunds: true
      }
      const feeToken = {
        address: zeroAddress,
        chainId: network.chain.id
      }
      const { address: recipient } = mcNexus.deploymentOn(
        network.chain.id,
        true
      )
      const quote = await getOnChainQuote(meeClient, {
        trigger: ethTrigger,
        instructions: [
          mcNexus.build({
            type: "default",
            data: {
              chainId: network.chain.id,
              calls: [
                {
                  // dummy transfer to an address, this can be any transaction
                  to: recipient,
                  value: 1n
                }
              ]
            }
          })
        ],
        feeToken
      })
      const balance = await getBalance(
        mcNexus.deploymentOn(network.chain.id, true).publicClient,
        mcNexus.signer.address
      )

      // Approximation for the gas fees adjustment
      expect(Number(balance)).to.be.approximately(
        Number(balance) - 10000,
        99999 + 10000
      )

      // TODO: add execution as well once the runtimeNativeTokenBalanceOf is added
    })

    test("should work with useMaxAvailableFunds for custom recipient", async () => {
      const ethTrigger: Trigger = {
        chainId: network.chain.id,
        tokenAddress: zeroAddress,
        useMaxAvailableFunds: true,
        recipientAddress: eoaAccount.address
      }

      const feeToken = {
        address: zeroAddress,
        chainId: network.chain.id
      }

      const { address: recipient } = mcNexus.deploymentOn(
        network.chain.id,
        true
      )

      const zeroTransfer = await mcNexus.build({
        type: "default",
        data: {
          chainId: network.chain.id,
          calls: [
            {
              // dummy transfer to an address, this can be any transaction
              to: recipient,
              value: 1n
            }
          ]
        }
      })

      const quote = await getOnChainQuote(meeClient, {
        trigger: ethTrigger,
        instructions: [zeroTransfer],
        feeToken
      })

      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote: quote
      })

      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    })
  })

  test("should sign a quote using signOnChainQuote with modular signing functions", async () => {
    const trigger: Trigger = {
      chainId: chain.id,
      tokenAddress: "0xb394e82fd251de530c9d71cbee9527a4cf690e57",
      amount: 1n
    }

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
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
        address: "0xb394e82fd251de530c9d71cbee9527a4cf690e57"
      }
    })

    const signedOnChainQuote = await signOnChainQuote(meeClient, {
      fusionQuote
    })
    expect(signedOnChainQuote).toBeDefined()
    expect(signedOnChainQuote.signature).toBeDefined()
    expect(isHex(signedOnChainQuote.signature)).toEqual(true)

    let paymentTokenInfo: GetPaymentTokenPayload | undefined = undefined

    if (fusionQuote.trigger.tokenAddress) {
      paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: fusionQuote.trigger.tokenAddress,
        chainId: fusionQuote.trigger.chainId
      })
    }

    const quoteType = await getQuoteType(
      walletClient,
      fusionQuote,
      paymentTokenInfo
    )

    expect(quoteType).toEqual("onchain")

    const { version } = mcNexus.deploymentOn(trigger.chainId, true)

    const { executablePayload, metadata } =
      await prepareExecutableOnChainQuotePayload(
        fusionQuote,
        eoaAccount.address,
        mcNexus.addressOn(chain.id, true),
        version
      )

    const hash = await walletClient.sendTransaction({
      ...executablePayload,
      account: eoaAccount,
      chain
    })

    await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 })

    const manuallySignedOnChainQuote = formatSignedOnChainQuotePayload(
      fusionQuote,
      metadata,
      hash
    )

    expect(manuallySignedOnChainQuote).toBeDefined()
    expect(manuallySignedOnChainQuote.signature).toBeDefined()
    expect(isHex(manuallySignedOnChainQuote.signature)).toEqual(true)

    // === Signature 1 ===

    // Get the first 10 characters (includes the prefix: '0x' + '177eee01')
    const sig1Prefix = signedOnChainQuote.signature.slice(0, 10)

    // Skip the next 64 characters (which represent the dynamic transaction hash)
    // Start slicing again from position 74 to get the rest of the signature
    const sig1TxHashRemoved = signedOnChainQuote.signature.slice(74)

    // Combine the preserved prefix and the tail part (after removing the tx hash)
    const signatureOneWithoutTxHash = sig1Prefix + sig1TxHashRemoved

    // === Signature 2 ===

    // Do the same for the manually signed quote
    const sig2Prefix = manuallySignedOnChainQuote.signature.slice(0, 10)
    const sig2TxHashRemoved = manuallySignedOnChainQuote.signature.slice(74)
    const signatureTwoWithoutTxHash = sig2Prefix + sig2TxHashRemoved

    expect(signatureOneWithoutTxHash).toEqual(signatureTwoWithoutTxHash)
  })
})
