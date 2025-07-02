import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport
} from "viem"
import { base } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  MAINNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import { getMeeScanLink } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC, mcUSDT } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getOnChainQuote from "./getOnChainQuote"
import type { FeeTokenInfo, Instruction } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

describe("mee.getOnChainQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  const index = 60n // Randomly chosen index

  let tokenAddress: Address
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

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test("should resolve instructions", async () => {
    const trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n
    }

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
      },
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
    expect(instructions.length).toEqual(2)

    const fusionQuote = await getOnChainQuote(meeClient, {
      instructions,
      feeToken,
      trigger
    })

    expect(fusionQuote.quote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
  })

  // This is a mainnet onchain fusion flow test. Still the SDK doesn't have fund setup for non permit tokens.
  // Will be skipped for now
  test.skip("On chain fusion flow token transfer", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [base],
      signer: eoaAccount,
      transports: [http(MAINNET_RPC_URLS[base.id])]
    })

    const meeClient = await createMeeClient({
      account: mcNexus
    })

    const amountToTransfer = 1n

    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDT.addressOn(base.id),
        amount: amountToTransfer,
        chainId: base.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        amount: amountToTransfer,
        chainId: base.id,
        tokenAddress: mcUSDT.addressOn(base.id)
      },
      instructions: [transfer],
      feeToken: {
        address: mcUSDT.addressOn(base.id),
        chainId: base.id
      }
    })

    console.log(getMeeScanLink(quote.quote.hash))

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote: quote })

    await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })
  })

  // This is a mainnet onchain fusion flow test. Still the SDK doesn't have fund setup for non permit tokens.
  // Will be skipped for now
  test.skip("Trigger amount should be transferred to the custom recipient", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [base],
      signer: eoaAccount,
      transports: [http(MAINNET_RPC_URLS[base.id])]
    })

    const { publicClient } = mcNexus.deploymentOn(base.id, true)

    const meeClient = await createMeeClient({
      account: mcNexus
    })

    const balanceBefore = await getBalance(
      publicClient,
      eoaAccount.address,
      mcUSDT.addressOn(base.id)
    )

    const trigger = {
      amount: 1n,
      recipientAddress: eoaAccount.address,
      chainId: base.id,
      tokenAddress: mcUSDT.addressOn(base.id)
    }

    const fusionQuote = await meeClient.getFusionQuote({
      trigger,
      instructions: [],
      feeToken: {
        address: mcUSDT.addressOn(base.id),
        chainId: base.id
      }
    })

    console.log(getMeeScanLink(fusionQuote.quote.hash))

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    const balanceAfter = await getBalance(
      publicClient,
      eoaAccount.address,
      mcUSDT.addressOn(base.id)
    )

    expect(balanceBefore).to.eq(
      balanceAfter + BigInt(fusionQuote.quote.paymentInfo.tokenWeiAmount)
    )
  })

  // This is a mainnet onchain fusion flow test. Still the SDK doesn't have fund setup for non permit tokens.
  // Will be skipped for now
  test.skip("Trigger max available amount should be transferred to the custom recipient", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [base],
      signer: eoaAccount,
      transports: [http(MAINNET_RPC_URLS[base.id])]
    })

    const { publicClient } = mcNexus.deploymentOn(base.id, true)

    const meeClient = await createMeeClient({
      account: mcNexus
    })

    const balanceBefore = await getBalance(
      publicClient,
      eoaAccount.address,
      mcUSDT.addressOn(base.id)
    )

    const trigger: Trigger = {
      useMaxAvailableFunds: true,
      recipientAddress: eoaAccount.address,
      chainId: base.id,
      tokenAddress: mcUSDT.addressOn(base.id)
    }

    const fusionQuote = await meeClient.getFusionQuote({
      trigger,
      instructions: [],
      feeToken: {
        address: mcUSDT.addressOn(base.id),
        chainId: base.id
      }
    })

    console.log(getMeeScanLink(fusionQuote.quote.hash))

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    const balanceAfter = await getBalance(
      publicClient,
      eoaAccount.address,
      mcUSDT.addressOn(base.id)
    )

    expect(balanceBefore).to.eq(
      balanceAfter + BigInt(fusionQuote.quote.paymentInfo.tokenWeiAmount)
    )
  })
})
