import { type Chain, type Hex, type LocalAccount, isHex } from "viem"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeSignedQuote from "./executeSignedQuote"
import { type FeeTokenInfo, getQuote } from "./getQuote"
import { signOnChainQuote } from "./signOnChainQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe.runIf(runPaidTests)("mee.signOnChainQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain
  let tokenAddress: Hex

  const index = 79n // Randomly chosen index

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
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test(
    "should execute a quote using signOnChainQuote",
    async () => {
      console.time("signOnChainQuote:getQuote")
      console.time("signOnChainQuote:getHash")
      console.time("signOnChainQuote:receipt")

      const trigger = {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      }

      const sender = eoaAccount.address
      const recipient = mcNexus.addressOn(paymentChain.id, true)

      const quote = await getQuote(meeClient, {
        path: "v1/quote-permit",
        eoa: mcNexus.signer.address,
        instructions: [
          mcNexus.build({
            type: "transferFrom",
            data: { ...trigger, sender, recipient }
          }),
          mcNexus.build({
            type: "transfer",
            data: {
              ...trigger,
              recipient: eoaAccount.address
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
    },
    {
      timeout: 1000000
    }
  )
})
