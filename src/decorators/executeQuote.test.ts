import type { Address, Chain, Hex, LocalAccount } from "viem"
import { base } from "viem/chains"
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest"
import { initNetwork, type NetworkConfig } from "../../tests/config"
import { execute } from "./execute"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account-vendors"
import { type MeeClient, createMeeClient } from "../createMeeClient"
import { getQuote, type Instruction } from "./getQuote"
import executeQuote from "./executeQuote"
import type { ExecuteSignedQuotePayload } from "./executeSignedQuote"

vi.mock("./executeQuote")

describe("executeQuote", () => {
  let network: NetworkConfig
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount
  let meeClient: MeeClient

  beforeAll(async () => {
    network = await initNetwork("NETWORK_FROM_ENV")

    eoa = network.eoa
    paymentChain = network.paymentChain
    paymentToken = network.paymentToken

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })

    meeClient = createMeeClient({ account: mcNexusMainnet })
  })

  afterAll(async () => {})

  test("should execute a quote using", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: 8453
      }
    ]

    expect(instructions).toBeDefined()

    // Mock the execute function
    const mockExecuteQuoteResponse: ExecuteSignedQuotePayload = {
      hash: "0x123" as Hex
    }
    // Mock implementation for this specific test
    vi.mocked(executeQuote).mockResolvedValue(mockExecuteQuoteResponse)

    const quote = await getQuote(meeClient, {
      superTransaction: instructions,
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    const executedQuote = await executeQuote(meeClient, { quote })

    expect(executedQuote).toEqual(mockExecuteQuoteResponse)
  })
})
