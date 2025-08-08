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
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
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
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import getFusionQuote from "./getFusionQuote"
import getPaymentToken, { type GetPaymentTokenPayload } from "./getPaymentToken"
import { type FeeTokenInfo, getQuote } from "./getQuote"
import { getQuoteType } from "./getQuoteType"
import {
  type Trigger,
  formatSignedPermitQuotePayload,
  prepareSignablePermitQuotePayload,
  signPermitQuote
} from "./signPermitQuote"
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

    const signedPermitQuote = await signPermitQuote(meeClient, { fusionQuote })
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

      const recipient = mcNexus.addressOn(paymentChain.id, true)
      const sender = mcNexus.signer.address

      const quote = await getQuote(meeClient, {
        path: "quote-permit",
        eoa: sender,
        instructions: [
          mcNexus.build({
            type: "transferFrom",
            data: { ...trigger, recipient, sender }
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

      const fusionQuote = {
        quote,
        trigger: {
          ...trigger,
          amount:
            BigInt(trigger.amount) + BigInt(quote.paymentInfo.tokenWeiAmount)
        }
      }

      console.timeEnd("signPermitQuote:getQuote")
      const signedQuote = await signPermitQuote(meeClient, { fusionQuote })
      const { hash } = await executeSignedQuote(meeClient, { signedQuote })
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

    const signedPermitQuote = await signPermitQuote(meeClient, { fusionQuote })
    expect(signedPermitQuote).toBeDefined()
    expect(signedPermitQuote.signature).toBeDefined()
    expect(isHex(signedPermitQuote.signature)).toEqual(true)

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

    expect(quoteType).toEqual("permit")

    const { signablePayload, metadata } =
      await prepareSignablePermitQuotePayload(
        fusionQuote,
        eoaAccount.address,
        mcNexus.addressOn(chain.id, true),
        walletClient
      )

    const signature = await walletClient.signTypedData({
      ...signablePayload,
      account: walletClient.account!
    })

    const manuallySignedPermitQuote = formatSignedPermitQuotePayload(
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
})
