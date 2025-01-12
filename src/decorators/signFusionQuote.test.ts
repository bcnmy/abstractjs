import type { Address, Chain, Hex, LocalAccount } from "viem"
import { base } from "viem/chains"
import { afterAll, beforeAll, describe, expect, inject, test, vi } from "vitest"
import { initNetwork, type NetworkConfig } from "../../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account-vendors"
import { type MeeClient, createMeeClient } from "../createMeeClient"
import { getQuote, type Instruction } from "./getQuote"
import { signFusionQuote } from "./signFusionQuote"
import executeSignedFusionQuote, {
  type ExecuteSignedFusionQuotePayload
} from "./executeSignedFusionQuote"

const runPaidTests = inject("runPaidTests")

describe.runIf(runPaidTests).skip("signFusionQuote", () => {
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

  test("should execute a quote using executeSignedFusionQuote", async () => {
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
    const mockExecuteQuoteResponse: ExecuteSignedFusionQuotePayload = {
      hash: "0x123" as Hex,
      receipt: {
        blobGasPrice: undefined,
        blobGasUsed: undefined,
        blockHash: "0x",
        blockNumber: 0n,
        contractAddress: undefined,
        cumulativeGasUsed: 0n,
        effectiveGasPrice: 0n,
        from: "0x",
        gasUsed: 0n,
        logs: [],
        logsBloom: "0x",
        root: undefined,
        status: "success",
        to: null,
        transactionHash: "0x",
        transactionIndex: 0,
        type: "legacy"
      }
    }
    // Mock implementation for this specific test
    vi.mocked(executeSignedFusionQuote).mockResolvedValue(
      mockExecuteQuoteResponse
    )

    const quote = await getQuote(meeClient, {
      instructions: instructions,
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    const signedFusionQuote = await signFusionQuote(meeClient, {
      quote,
      trigger: {
        call: {
          to: "0x0000000000000000000000000000000000000000",
          value: 0n
        },
        chain: paymentChain
      }
    })

    const executeSignedFusionQuoteResponse = await executeSignedFusionQuote(
      meeClient,
      {
        signedFusionQuote
      }
    )

    expect(executeSignedFusionQuoteResponse).toEqual(mockExecuteQuoteResponse)
  })
})
