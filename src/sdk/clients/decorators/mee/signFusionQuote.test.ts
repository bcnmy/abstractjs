import { type Address, type Chain, type LocalAccount, zeroAddress } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import getFusionQuote from "./getFusionQuote"
import type { FeeTokenInfo } from "./getQuote"
import { signFusionQuote } from "./signFusionQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

describe("mee.signFusionQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  let recipientAccount: LocalAccount
  let tokenAddress: Address

  const index = 11n // Randomly chosen index

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    recipientAccount = privateKeyToAccount(generatePrivateKey())

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

  test.skip("should sign a quote using signFusionQuote", async () => {
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger: {
        chainId: targetChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    const signedFusionQuote = await signFusionQuote(meeClient, {
      fusionQuote
    })

    console.log(JSON.stringify(signedFusionQuote, null, 2))
  })

  test(
    "should execute a signed fusion quote using signFusionQuote",
    async () => {
      console.time("permitQuote:getQuote")
      console.time("permitQuote:getHash")
      console.time("permitQuote:receipt")

      const triggerAmount = 1n

      const { publicClient } = mcNexus.deploymentOn(paymentChain.id, true)
      const usdcFromPaymentChain = mcUSDC.addressOn(paymentChain.id)

      const fusionQuote = await getFusionQuote(meeClient, {
        trigger: {
          chainId: paymentChain.id,
          tokenAddress,
          amount: triggerAmount
        },
        instructions: [
          mcNexus.build({
            type: "transfer",
            data: {
              chainId: paymentChain.id,
              tokenAddress,
              amount: triggerAmount,
              recipient: recipientAccount.address
            }
          })
        ],
        feeToken
      })

      console.timeEnd("permitQuote:getQuote")
      const signedQuote = await signFusionQuote(meeClient, { fusionQuote })
      const { hash } = await executeSignedQuote(meeClient, { signedQuote })
      console.timeEnd("permitQuote:getHash")
      const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
      console.timeEnd("permitQuote:receipt")
      expect(receipt).toBeDefined()
      console.log(receipt.explorerLinks)

      const recipientBalanceAfter = await getBalance(
        publicClient,
        recipientAccount.address,
        usdcFromPaymentChain
      )
      expect(recipientBalanceAfter).toBe(triggerAmount)
    },
    {
      timeout: 2000000
    }
  )
})
