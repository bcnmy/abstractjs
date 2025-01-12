import type { Address, Chain, erc20Abi, LocalAccount } from "viem"
import { base } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { initNetwork, type NetworkConfig } from "../../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account-vendors"
import { type MeeClient, createMeeClient } from "../createMeeClient"
import { getQuote, type Instruction } from "./getQuote"
import { mcUSDC } from "../utils/tokens"
import { requireErc20Balance } from "../utils/syntax/require-funds-on-chain"
import { getMultichainContract } from "../utils/contract/getMultichainContract"

describe("getQuote", () => {
  let network: NetworkConfig
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount
  let meeClient: MeeClient

  beforeAll(async () => {
    network = await initNetwork("NETWORK_FROM_ENV")

    eoa = network.eoa
    paymentChain = network.paymentChain
    paymentToken = network.paymentToken

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })

    meeClient = createMeeClient({ account: mcNexusMainnet })
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
        chainId: 8453
      },
      () => ({
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: 8453
      }),
      Promise.resolve({
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: 8453
      })
    ]

    expect(instructions).toBeDefined()
    expect(instructions.length).toEqual(3)

    const quote = await getQuote(meeClient, {
      instructions: instructions,
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    expect(quote).toBeDefined()
  })
})
