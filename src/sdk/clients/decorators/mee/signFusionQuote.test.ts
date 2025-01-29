import {
  type Chain,
  type Hex,
  type LocalAccount,
  isHex,
  zeroAddress
} from "viem"
import { beforeAll, describe, expect, inject, test, vi } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeSignedFusionQuote from "./executeSignedFusionQuote"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"
import { signFusionQuote } from "./signFusionQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

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

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should execute a quote using executeSignedFusionQuote", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
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

    const signedFusionQuote = await signFusionQuote(meeClient, {
      quote,
      trigger: {
        call: {
          to: zeroAddress,
          value: 0n
        },
        chain: targetChain
      }
    })

    const executeSignedFusionQuoteResponse = await executeSignedFusionQuote(
      meeClient,
      { signedFusionQuote }
    )

    const superTransactionReceipt = await waitForSupertransactionReceipt(
      meeClient,
      {
        hash: executeSignedFusionQuoteResponse.hash
      }
    )

    console.log(JSON.stringify(superTransactionReceipt.explorerLinks, null, 2))
    expect(superTransactionReceipt.explorerLinks.length).toBeGreaterThan(0)
    expect(executeSignedFusionQuoteResponse.receipt.status).toBe("success")
    expect(
      isHex(executeSignedFusionQuoteResponse.receipt.transactionHash)
    ).toBe(true)
    expect(isHex(executeSignedFusionQuoteResponse.hash)).toBe(true)
  })
})
