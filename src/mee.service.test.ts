import { type LocalAccount, type Chain, zeroAddress, isHex } from "viem"
import { base } from "viem/chains"
import { inject, describe, beforeAll, test, expect } from "vitest"
import { initNetwork } from "../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "./account-vendors"
import { createMeeService } from "./mee.service"
import {
  supertransaction,
  type SupportedFeeChainId,
  signMeeQuote
} from "./utils"
import { getExplorerTxLink } from "./utils/explorer/explorer"
import { buildMeeUserOp } from "./workflow"

const runPaidTests = inject("runPaidTests")

describe.runIf(runPaidTests)("meeService", async (args) => {
  let eoa: LocalAccount
  let paymentChain: Chain
  let mcNexusMainnet: MultichainSmartAccount

  const meeService = createMeeService()

  beforeAll(async () => {
    const network = await initNetwork("NETWORK_FROM_ENV")
    eoa = network.eoa
    paymentChain = network.paymentChain

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })
  })

  test("should get a quote", async () => {
    const mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })

    const quote = await supertransaction()
      .injectAccount(mcNexusMainnet)
      .payGasWith("USDC", { on: paymentChain.id as SupportedFeeChainId })
      .addInstructions(
        buildMeeUserOp({
          calls: {
            to: zeroAddress,
            gasLimit: 50_000n,
            value: 0n
          },
          chainId: base.id
        })
      )
      .getQuote(meeService)

    expect(quote.hash.startsWith("0x")).toBeTruthy()

    const receipt = await meeService.execute(
      await signMeeQuote({
        executionMode: "direct-to-mee",
        quote: quote,
        signer: eoa
      })
    )

    expect(isHex(receipt.hash)).toBeTruthy()
    const explorerUrl = getExplorerTxLink(receipt.hash)

    expect(explorerUrl).toEqual(
      `https://meescan.biconomy.io/details/${receipt.hash}`
    )
    console.log(`Supertransaction: ${explorerUrl}`)
  })
})
