import {
  http,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport
} from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, test, vi } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type { ExecuteSignedQuotePayload } from "./executeSignedQuote"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"
import { getQuoteType } from "./getQuoteType"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.executeQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

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
      ]
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  describe("mocked", () => {
    test("should execute a quote using vi mocks", async () => {
      const mockExecuteQuoteResponse: ExecuteSignedQuotePayload = {
        hash: "0x123" as Hex
      }

      // Use vi.doMock (not hoisted) so it doesn't affect other tests
      vi.doMock("./executeQuote", () => ({
        default: vi.fn().mockResolvedValue(mockExecuteQuoteResponse)
      }))

      // Import after mocking
      const { default: executeQuote } = await import("./executeQuote")

      const instructions: Instruction[] = [
        {
          calls: [
            {
              to: "0x0000000000000000000000000000000000000000",
              gasLimit: 50000n,
              value: 0n
            }
          ],
          chainId: targetChain.id
        }
      ]

      expect(instructions).toBeDefined()

      const quote = await getQuote(meeClient, {
        instructions: instructions,
        feeToken
      })

      const executedQuote = await executeQuote(meeClient, { quote })

      expect(executedQuote).toEqual(mockExecuteQuoteResponse)

      // Clean up: reset modules so the mock doesn't affect other tests
      vi.doUnmock("./executeQuote")
      vi.resetModules()
    })
  })

  test.runIf(runPaidTests)(
    "should execute quote with 'smart-account' mode with personal sign (MEE = 2.1.0)",
    async () => {
      const executeQuote = (await import("./executeQuote")).default

      const mcNexusV2_1_0 = await toMultichainNexusAccount({
        signer: eoaAccount,
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(MEEVersion.V2_1_0)
          }
        ]
      })

      const meeClientV2_1_0 = await createMeeClient({
        account: mcNexusV2_1_0
      })

      const quote = await meeClientV2_1_0.getQuote({
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 0n
              }
            ],
            chainId: baseSepolia.id
          }
        ],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(baseSepolia.id),
          chainId: baseSepolia.id
        }
      })

      expect(quote).toBeDefined()
      expect(quote.hash).toBeDefined()

      const { hash } = await meeClientV2_1_0.executeQuote({ quote })

      expect(hash).toBeDefined()

      const receipt = await meeClientV2_1_0.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }
  )

  // should execute quote with 'smart-account' mode with typed data sign (MEE >= 2.2.1)
  test.runIf(runPaidTests)(
    "should execute quote with 'smart-account' mode with typed data sign (MEE >= 2.2.1)",
    async () => {
      const mcNexusV2_2_1 = await toMultichainNexusAccount({
        signer: eoaAccount,
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(MEEVersion.V2_2_1)
          }
        ]
      })

      const meeClientV2_2_1 = await createMeeClient({
        account: mcNexusV2_2_1
      })

      console.log(
        "mcNexusV2_2_1 address on baseSepolia:",
        await mcNexusV2_2_1.deploymentOn(baseSepolia.id, true).getAddress()
      )

      const quote = await meeClientV2_2_1.getQuote({
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 0n
              }
            ],
            chainId: baseSepolia.id
          }
        ],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(baseSepolia.id),
          chainId: baseSepolia.id
        }
      })

      expect(quote).toBeDefined()
      expect(quote.hash).toBeDefined()
      const quoteType = await getQuoteType(meeClientV2_2_1, quote)
      expect(quoteType).toBe("simple")

      console.log("quote hash:", quote.hash)

      const { hash } = await meeClientV2_2_1.executeQuote({ quote })

      console.log("execute quote hash:", hash)
      expect(hash).toBeDefined()

      const receipt = await meeClientV2_2_1.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }
  )

  // should execute sponsored quote with with MEE >= 2.2.1
  test.runIf(runPaidTests)(
    "should execute sponsored quote with with MEE >= 2.2.1",
    async () => {}
  )
})
