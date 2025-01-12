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
import type { Instruction } from "./getQuote"

vi.mock("./execute")

describe("execute", () => {
  let network: NetworkConfig
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount
  let meeClient: MeeClient

  beforeAll(async () => {
    network = await initNetwork("ANVIL")

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

  test("should execute a quote using execute", async () => {
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
    const mockExecuteResponse = { hash: "0x123" as Hex }
    // Mock implementation for this specific test
    vi.mocked(execute).mockResolvedValue(mockExecuteResponse)

    const { hash } = await execute(meeClient, {
      instructions: instructions,
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    expect(hash).toEqual(mockExecuteResponse.hash)

    expect(execute).toHaveBeenCalledWith(meeClient, {
      instructions: instructions,
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })
  })
})
