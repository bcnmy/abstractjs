import type { Chain, Hex, LocalAccount } from "viem"
import { optimism } from "viem/chains"
import { beforeAll, describe, expect, inject, test, vi } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeSignedFusionQuote, {
  type ExecuteSignedFusionQuotePayload
} from "./executeSignedFusionQuote"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"
import { signFusionQuote } from "./signFusionQuote"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { mcUSDC } from "../../../constants/tokens"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe.runIf(runPaidTests).skip("mee.signFusionQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = createMeeClient({ account: mcNexus })
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
        chainId: targetChain.id
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
      feeToken
    })

    const signedFusionQuote = await signFusionQuote(meeClient, {
      quote,
      trigger: {
        call: {
          to: "0x0000000000000000000000000000000000000000",
          value: 0n
        },
        chain: network.chain
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
