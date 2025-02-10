import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeFusionQuote from "./executeFusionQuote"
import getFusionQuote from "./getFusionQuote"
import type { FeeTokenInfo } from "./getQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runPaidTests } = inject("settings")

// Tests below are skipped because they conflict with permit flows when the same nonce for the eoa is used
describe.runIf(runPaidTests).skip("mee.executeFusionQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let recipientAccount: LocalAccount
  let tokenAddress: Address

  const index = 101n // Randomly chosen index

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    recipientAccount = privateKeyToAccount(generatePrivateKey())

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test("should execute a signed fusion quote using executeFusionQuote", async () => {
    console.time("executeFusionQuote:getQuote")
    console.time("executeFusionQuote:receipt")

    const triggerAmount = 1n

    const { publicClient } = mcNexus.deploymentOn(paymentChain.id, true)

    const trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: triggerAmount
    }

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [
        mcNexus.build({
          type: "transfer",
          data: {
            ...trigger,
            recipient: recipientAccount.address
          }
        })
      ],
      feeToken
    })

    console.timeEnd("executeFusionQuote:getQuote")
    const { hash } = await executeFusionQuote(meeClient, { fusionQuote })
    const receipt = await waitForSupertransactionReceipt(meeClient, {
      hash,
      confirmations: 3
    })
    console.timeEnd("executeFusionQuote:receipt")
    expect(receipt).toBeDefined()
    console.log(receipt.explorerLinks)

    const recipientBalanceAfter = await getBalance(
      publicClient,
      recipientAccount.address,
      tokenAddress
    )
    expect(recipientBalanceAfter).toBe(triggerAmount)
  })
})
