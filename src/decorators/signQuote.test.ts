import { isHex, type Address, type Chain, type LocalAccount } from "viem"
import { base } from "viem/chains"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { initNetwork, type NetworkConfig } from "../../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account-vendors"
import { type MeeClient, createMeeClient } from "../createMeeClient"
import type { Instruction } from "./getQuote"
import { signQuote } from "./signQuote"

describe("signQuote", () => {
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
  afterAll(async () => await network.anvilInstance?.stop())

  test("should sign a quote", async () => {
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
      }
    ]

    expect(instructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions: instructions,
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(signedQuote.signature).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
  })
})
