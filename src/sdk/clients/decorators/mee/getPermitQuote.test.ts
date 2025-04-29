import {
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  createPublicClient,
  parseUnits,
  zeroAddress
} from "viem"
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
import { getAllowance } from "../../../account/utils/Utils"
import { mcUSDC } from "../../../constants/tokens"
import { runtimeERC20BalanceOf } from "../../../modules/utils/composabilityCalls"
import {
  DEFAULT_MEE_NODE_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
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

  const recipient: Address = "0x3079B249DFDE4692D7844aA261f8cf7D927A0DA5"

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

    meeClient = await createMeeClient({
      account: mcNexus,
      url: DEFAULT_MEE_NODE_URL
    })
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
    const client = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    const totalBalance = await getBalance(
      client,
      eoaAccount.address,
      tokenAddress
    )

    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: totalBalance,
      useMaxAvailableAmount: true
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

    // The final amount should be the total balance
    expect(fusionQuote.trigger.amount).toBe(totalBalance)

    // Verify that the amount is usable (not negative)
    expect(fusionQuote.trigger.amount).toBeGreaterThan(0n)
  })

  // @ts-ignore
  test("should investigate issue for swapped", async () => {
    expect(1).toEqual(1)

    const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const chainId = paymentChain.id
    const client = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    console.log({ paymentChain })

    const amount = 7000n // should be more than the cost of gas
    const vitalikBalance = await getBalance(client, vitalik, tokenAddress)
    const eoaBalance = await getBalance(
      client,
      eoaAccount.address,
      tokenAddress
    )
    const mcNexusAddress = mcNexus.addressOn(paymentChain.id, true)
    const mcNexusBalance = await getBalance(
      client,
      mcNexusAddress,
      tokenAddress
    )
    const allowance = await getAllowance(
      client,
      eoaAccount.address,
      tokenAddress,
      mcNexusAddress
    )

    console.log("vitalikBalance", vitalikBalance)
    console.log("eoaBalance", eoaBalance)
    console.log("mcNexusAddress", mcNexusAddress)
    console.log("mcNexusBalance", mcNexusBalance)
    console.log("allowance", allowance)

    const trigger: Trigger = {
      amount,
      chainId,
      tokenAddress,
      useMaxAvailableAmount: true
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId,
        tokenAddress,
        recipient: vitalik,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexusAddress,
          tokenAddress
        })
      }
    })

    const fusionQuote = await meeClient.getPermitQuote({
      trigger,
      instructions: [transferInstruction],
      feeToken
    })

    console.log("fusionQuote", fusionQuote)

    const signedQuote = await signPermitQuote(meeClient, { fusionQuote })

    console.log("signedPermitQuote", signedQuote)
    console.log(
      "signedPermitQuote.userOps[0].userOp",
      signedQuote.userOps[0].userOp
    )
    console.log(
      "signedPermitQuote.userOps[1].userOp",
      signedQuote.userOps[1].userOp
    )

    const { hash } = await executeSignedQuote(meeClient, { signedQuote })
    console.log("hash", hash)

    const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
    console.log("receipt", receipt)
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
      amount: amount
      // useMaxAvailableAmount not set, should default to false
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
