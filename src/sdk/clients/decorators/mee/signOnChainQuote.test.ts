import {
  http,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  isHex
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { waitForTransactionReceipt } from "viem/actions"
import { base, optimism } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { getAllowance } from "../../../account/utils/Utils"
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
  let recipientAccount: LocalAccount
  let tokenAddress: Hex

  const index = 79n // Randomly chosen index

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    recipientAccount = privateKeyToAccount(generatePrivateKey())

    feeToken = {
      address: mcUSDC.addressOn(optimism.id),
      chainId: optimism.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(optimism.id)
  })

  // Skip this test as it will conflict with the other tests as it uses the same eoa account, and the nonce will be the same
  test.skip("should execute a quote using signOnChainQuote", async () => {
    console.time("signOnChainQuote:getQuote")
    console.time("signOnChainQuote:getHash")
    console.time("signOnChainQuote:receipt")

    const trigger = {
      chainId: optimism.id,
      tokenAddress,
      amount: 1n
    }

    const sender = mcNexus.signer.address
    const { address: recipient } = mcNexus.deploymentOn(optimism.id, true)

    console.log({ recipient })

    const quote = await getQuote(meeClient, {
      path: "v1/quote-permit",
      eoa: sender,
      instructions: [
        mcNexus.build({
          type: "transferFrom",
          data: { ...trigger, sender, recipient }
        }),
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

    const balanceOfRecipient = await getBalance(
      mcNexus.deploymentOn(optimism.id, true).publicClient,
      recipientAccount.address,
      tokenAddress
    )
    expect(balanceOfRecipient).toBe(trigger.amount)
  })
})
