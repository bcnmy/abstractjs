import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  createPublicClient,
  parseUnits,
  zeroAddress
} from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  type FeeTokenInfo,
  type Instruction,
  type Trigger,
  executeSignedQuote,
  getFusionQuote,
  signPermitQuote,
  waitForSupertransactionReceipt
} from "."
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { getBalance } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC, testnetMcUSDC } from "../../../constants/tokens"
import {
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf
} from "../../../modules/utils/composabilityCalls"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getPermitQuote from "./getPermitQuote"

describe("mee.getPermitQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
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

    const quote = await getPermitQuote(meeClient, {
      trigger,
      instructions,
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const fusionQuote = await getPermitQuote(meeClient, {
      trigger: {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "intent",
          data: {
            amount: 1n,
            mcToken: mcUSDC,
            toChain: targetChain
          }
        }),
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    expect(fusionQuote.quote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect([3, 4].includes(fusionQuote.quote.userOps.length)).toBe(true) // 3 or 4 depending on if bridging is needed
  })

  test("should reserve gas fees when using max available amount", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [baseSepolia],
      transports: [http()],
      signer: eoaAccount
    })

    const meeClient = await createMeeClient({ account: mcNexus })

    const client = createPublicClient({
      chain: baseSepolia,
      transport: http()
    })

    const trigger: Trigger = {
      chainId: baseSepolia.id,
      tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
      useMaxAvailableFunds: true
    }

    // withdraw
    const withdrawal = mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(baseSepolia.id, true),
          tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id)
        }),
        chainId: baseSepolia.id
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [withdrawal],
      feeToken: {
        address: testnetMcUSDC.addressOn(baseSepolia.id),
        chainId: baseSepolia.id
      }
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // EOA balance maximum available balance fetch
    const maxAvailableBalance = await getBalance(
      client,
      eoaAccount.address,
      trigger.tokenAddress
    )

    // The final amount should be the total balance
    expect(fusionQuote.trigger.amount).toBe(maxAvailableBalance)
  })

  // This test uses available usdc on the eoa on mainnet, so should be skipped
  test.skip("should demo behaviour of max available amount", async () => {
    const client = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const chainId = paymentChain.id
    const mcNexusAddress = mcNexus.addressOn(paymentChain.id, true)

    const trigger: Trigger = {
      chainId,
      tokenAddress,
      useMaxAvailableFunds: true
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId,
        tokenAddress,
        recipient: vitalik,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexusAddress,
          tokenAddress,
          constraints: [greaterThanOrEqualTo(1n)]
        })
      }
    })

    const fusionQuote = await meeClient.getPermitQuote({
      trigger,
      instructions: [transferInstruction], // inx 1 => transferFrom (Runtime) + Dev userOps
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // EOA balance maximum available balance fetch
    const maxAvailableBalance = await getBalance(
      client,
      mcNexus.signer.address,
      trigger.tokenAddress
    )

    // The final amount should be the total balance
    expect(fusionQuote.trigger.amount).toBe(maxAvailableBalance)

    const signedQuote = await signPermitQuote(meeClient, { fusionQuote }) // Permit with 20k
    const { hash } = await executeSignedQuote(meeClient, { signedQuote })

    const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("should add gas fees to amount when not using max available amount", async () => {
    const client = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    const amount = parseUnits("1", 6) // 1 unit of token
    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount
      // max not set, should default to false
    }

    // withdraw
    const withdrawal = mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(paymentChain.id, true),
          tokenAddress
        }),
        chainId: paymentChain.id
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [withdrawal],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // The final amount should be the initial amount plus gas fees
    expect(fusionQuote.trigger.amount).toBe(
      amount + BigInt(fusionQuote.quote.paymentInfo.tokenWeiAmount)
    )
  })
})
