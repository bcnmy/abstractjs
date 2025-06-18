import {
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  http,
  isHex,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { optimism } from "viem/chains"
import { beforeAll, describe, expect, inject, test, vi } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { FORWARDER_ADDRESS } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeSignedQuote from "./executeSignedQuote"
import { type FeeTokenInfo, getQuote } from "./getQuote"
import { ON_CHAIN_PREFIX, signOnChainQuote } from "./signOnChainQuote"
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
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    recipientAccount = privateKeyToAccount(generatePrivateKey())

    feeToken = {
      address: mcUSDC.addressOn(optimism.id),
      chainId: optimism.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
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

    console.log({ recipient })

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
      { hash: executeSignedQuoteResponse.hash }
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
        confirmations: 0,
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
      transports: [http()],
      signer: eoaAccount,
      index: 1n
    })

    meeClient = await createMeeClient({
      account: mcNexus
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
    const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })
})
