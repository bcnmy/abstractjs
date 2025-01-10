import { isHex, type Address, type Chain, type LocalAccount } from "viem"
import { base, optimism } from "viem/chains"
import { afterAll, beforeAll, describe, expect, inject, test } from "vitest"
import { initNetwork, type NetworkConfig } from "../../../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account-vendors"

import * as tokens from "."
import { addressEquals } from "@biconomy/sdk"

describe("tokens", async () => {
  let network: NetworkConfig
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount

  beforeAll(async () => {
    network = await initNetwork("ANVIL")
    eoa = network.eoa
    paymentChain = network.paymentChain
    paymentToken = network.paymentToken

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, optimism, paymentChain],
      signer: eoa
    })
  })
  afterAll(async () => await network.anvilInstance?.stop())

  test("should have relevant properties", async () => {
    for (const token of Object.values(tokens)) {
      expect(token).toHaveProperty("addressOn")
      expect(token).toHaveProperty("deployments")
      expect(token).toHaveProperty("on")
      expect(token).toHaveProperty("read")
    }
  })

  test("should instantiate a client", async () => {
    const token = tokens.mcUSDC
    const tokenWithChain = token.addressOn(10)
    const mcNexusAddress = mcNexusMainnet.deploymentOn(base.id).address

    const balances = await token.read({
      onChains: [base, optimism],
      functionName: "balanceOf",
      args: [mcNexusAddress],
      account: mcNexusMainnet
    })

    expect(balances.length).toBe(2)

    expect(
      addressEquals(
        tokenWithChain,
        "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85"
      )
    ).toBe(true)
  })
})
