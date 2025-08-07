import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeFusionQuote from "./executeFusionQuote"
import getFusionQuote from "./getFusionQuote"
import type { FeeTokenInfo } from "./getQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe.runIf(runPaidTests)("mee.executeFusionQuote", () => {
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
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)

    recipientAccount = privateKeyToAccount(generatePrivateKey())

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
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
      confirmations: TEST_BLOCK_CONFIRMATIONS
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
