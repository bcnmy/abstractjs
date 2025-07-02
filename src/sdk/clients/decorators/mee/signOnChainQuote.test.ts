import {
  http,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  createPublicClient,
  createWalletClient,
  isHex,
  parseEther,
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
  pKey,
  setAllowance
} from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { FORWARDER_ADDRESS } from "../../../constants"
import { mcUSDC, mcUSDT } from "../../../constants/tokens"
import {
  DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
  DEFAULT_PATHFINDER_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import executeSignedQuote from "./executeSignedQuote"
import { type FeeTokenInfo, getQuote } from "./getQuote"
import { ON_CHAIN_PREFIX, signOnChainQuote } from "./signOnChainQuote"
import type { Trigger } from "./signPermitQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runPaidTests } = inject("settings")

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
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(optimism.id)
  })

  // Skip this test as it will conflict with the other tests as it uses the same eoa account, and the nonce will be the same
  test.skip("should execute a quote using signOnChainQuote", async () => {
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

      // Spy on account_.build
      const buildSpy = vi.spyOn(mcNexus, "build")

      // Mock walletClient.sendTransaction
      const mockSendTransaction = vi.fn().mockResolvedValue(
        // dummy hash
        "0x8f07b65846424c90560ecc8f76744b99caaa8fd9c08f2cf4ac61ed425aa821fe"
      )
      const mockWalletClient = {
        sendTransaction: mockSendTransaction,
        waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
        account: mcNexus.signer,
        chain: optimism
      }
      vi.spyOn(mcNexus, "deploymentOn").mockReturnValue({
        ...mcNexus.deploymentOn(optimism.id, true),
        // @ts-ignore expected errors since we're not using the full walletClient
        walletClient: mockWalletClient
      })

      const signedQuote = await signOnChainQuote(meeClient, {
        fusionQuote: {
          quote,
          trigger: ethTrigger
        }
      })

      // Verify account_.build was called with correct type and params
      expect(buildSpy).toHaveBeenCalledWith({
        type: "default",
        data: {
          calls: [
            {
              to: FORWARDER_ADDRESS,
              data: expect.any(String),
              value: ethTrigger.amount
            }
          ],
          chainId: optimism.id
        }
      })

      expect(mockSendTransaction).toHaveBeenCalledTimes(1)
      const call = mockSendTransaction.mock.calls[0][0]
      expect(call.to).toBe(FORWARDER_ADDRESS)
      expect(call.value).toBe(ethTrigger.amount)
      expect(call.data).toContain(quote.hash.substring(2, quote.hash.length))

      expect(signedQuote.signature).toBeDefined()
      expect(signedQuote.signature.startsWith(ON_CHAIN_PREFIX)).toBe(true)
    })

    test("should handle ERC20 approval trigger call", async () => {
      const erc20Trigger = {
        chainId: optimism.id,
        tokenAddress,
        amount: 1n
      }

      const { address: recipient } = mcNexus.deploymentOn(optimism.id, true)

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

      // Spy on account_.build
      const buildSpy = vi.spyOn(mcNexus, "build")

      // Mock walletClient.sendTransaction
      const mockSendTransaction = vi.fn().mockResolvedValue(
        // dummy hash
        "0x8f07b65846424c90560ecc8f76744b99caaa8fd9c08f2cf4ac61ed425aa821fe"
      )
      const mockWalletClient = {
        sendTransaction: mockSendTransaction,
        waitForTransactionReceipt: vi.fn().mockResolvedValue({}),
        account: mcNexus.signer,
        chain: optimism
      }
      vi.spyOn(mcNexus, "deploymentOn").mockReturnValue({
        ...mcNexus.deploymentOn(optimism.id, true),
        // @ts-ignore expected errors since we're not using the full walletClient
        walletClient: mockWalletClient
      })

      const signedQuote = await signOnChainQuote(meeClient, {
        confirmations: TEST_BLOCK_CONFIRMATIONS,
        fusionQuote: {
          quote,
          trigger: erc20Trigger
        }
      })

      // Verify account_.build was called with correct type and params
      expect(buildSpy).toHaveBeenCalledWith({
        type: "approve",
        data: {
          spender: recipient,
          tokenAddress: tokenAddress,
          chainId: optimism.id,
          amount: erc20Trigger.amount
        }
      })

      expect(mockSendTransaction).toHaveBeenCalledTimes(1)
      const call = mockSendTransaction.mock.calls[0][0]
      expect(call.to).toBe(tokenAddress)
      expect(call.data).toContain(quote.hash.substring(2, quote.hash.length))

      expect(signedQuote.signature).toBeDefined()
      expect(signedQuote.signature.startsWith(ON_CHAIN_PREFIX)).toBe(true)
    })
  })
  describe.skip("custom approvalAmount", () => {
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

    test("changes the allowance based on approvalAmount", async () => {
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

describe.runIf(runPaidTests)("mee.signOnChainQuote - testnet", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let chain: Chain

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain
    mcNexus = await toMultichainNexusAccount({
      chains: [chain],
      transports: [http(network.rpcUrl)],
      signer: eoaAccount,
      index: 1n
    })
    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
})
