import { type Chain, type LocalAccount, isHex, zeroAddress } from "viem"
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
import executeSignedQuote from "./executeSignedQuote"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"
import { signQuoteOnChain } from "./signQuoteOnChain"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe.runIf(runPaidTests).skip("mee.signQuoteOnChain", () => {
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

    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should execute a quote using executeSignedQuote", async () => {
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

    const signedQuote = await signQuoteOnChain(meeClient, {
      quote,
      trigger: {
        chainId: targetChain.id,
        address: mcUSDC.addressOn(targetChain.id),
        amount: 0n
      }
    })

    const executeSignedQuoteResponse = await executeSignedQuote(meeClient, {
      signedQuote
    })

    const superTransactionReceipt = await waitForSupertransactionReceipt(
      meeClient,
      {
        hash: executeSignedQuoteResponse.hash
      }
    )

    console.log(JSON.stringify(superTransactionReceipt.explorerLinks, null, 2))
    expect(superTransactionReceipt.explorerLinks.length).toBeGreaterThan(0)
    expect(isHex(executeSignedQuoteResponse.hash)).toBe(true)
  })
})
