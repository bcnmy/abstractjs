import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"

import * as tokens from "."
import { DEFAULT_MEE_VERSION } from ".."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"
import { addressEquals } from "../../account/utils/Utils"
import { getMEEVersion } from "../../modules"

describe("mee.tokens", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount

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

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
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
