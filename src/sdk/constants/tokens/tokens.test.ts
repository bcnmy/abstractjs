import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"

import * as tokens from "."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"
import { addressEquals } from "../../account/utils/Utils"

describe("mee.tokens", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })
  })

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
    const mcNexusAddress = mcNexus.deploymentOn(paymentChain.id)?.address

    if (!mcNexusAddress) {
      throw new Error("mcNexusAddress is undefined")
    }

    const balances = await token.read({
      onChains: [paymentChain, targetChain],
      functionName: "balanceOf",
      args: [mcNexusAddress],
      account: mcNexus
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
