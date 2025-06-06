import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import {
  CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION,
  DEFAULT_GAS_LIMIT,
  type FeeTokenInfo,
  type Instruction,
  getQuote
} from "./getQuote"

describe("mee.getQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
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
  })

  test("should resolve instructions", async () => {
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

    const quote = await getQuote(meeClient, { instructions, feeToken })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const quote = await getQuote(meeClient, {
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
                to: "0x0000000000000000000000000000000000000000",
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

    expect([2, 3].includes(quote.userOps.length)).toBe(true) // 2 or 3 depending on if bridging is needed
  })

  test("should payment info have a default gas limit", async () => {
    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      feeToken
    })

    expect(quote).toBeDefined()

    expect(quote.paymentInfo.callGasLimit).toBe(DEFAULT_GAS_LIMIT.toString())
  })

  test("should payment info have a custom gas limit", async () => {
    const customGasLimit = 100_000n

    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      gasLimit: customGasLimit,
      feeToken
    })

    expect(quote).toBeDefined()

    expect(quote.paymentInfo.callGasLimit).toBe(customGasLimit.toString())
  })

  test("Cleanup userOp should have extra time window", async () => {
    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      cleanUps: [
        {
          tokenAddress: mcUSDC.addressOn(paymentChain.id),
          chainId: paymentChain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      feeToken
    })

    expect(quote).toBeDefined()

    // userOp 1 => user defined
    // userOp 2 => cleanup which has 50% additional execution window from default execution window
    expect(
      quote.userOps[1].upperBoundTimestamp +
        CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION
    ).to.eq(quote.userOps[2].upperBoundTimestamp)

    // If no custom gasLimit for userOp ? Default large gas limit will be used
    expect(quote.userOps[2].userOp.callGasLimit).to.eq(
      LARGE_DEFAULT_GAS_LIMIT.toString()
    )
  })

  test("Cleanup userOp should have custom gas limit", async () => {
    const customGasLimit = 100_000n

    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      cleanUps: [
        {
          tokenAddress: mcUSDC.addressOn(paymentChain.id),
          chainId: paymentChain.id,
          recipientAddress: eoaAccount.address,
          gasLimit: customGasLimit
        }
      ],
      feeToken
    })

    expect(quote).toBeDefined()

    // userOp 2 => cleanup userOp
    expect(quote.userOps[2].userOp.callGasLimit).to.eq(
      customGasLimit.toString()
    )
  })
})
