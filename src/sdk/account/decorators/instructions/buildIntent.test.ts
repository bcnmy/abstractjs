import type { Chain, LocalAccount, Transport } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { Instruction } from "../../../clients/decorators/mee/getQuote"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import buildIntent from "./buildIntent"

describe("mee.buildIntent", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

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

    meeClient = await createMeeClient({ account: mcNexus })
  })

  it("should highlight building intent instructions", async () => {
    console.log("mcNexus", mcNexus.addressOn(targetChain.id))

    const instructions: Instruction[] = await buildIntent(
      { account: mcNexus },
      {
        amount: 1000000n,
        mcToken: mcUSDC,
        toChain: targetChain
      }
    )

    expect([1, 0]).toContain(instructions.length)
  })

  it("should highlight building optimistic intent instructions", async () => {
    const newMcNexus = await toMultichainNexusAccount({
      signer: privateKeyToAccount(generatePrivateKey()),
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

    const instructions: Instruction[] = await buildIntent(
      { account: newMcNexus },
      {
        amount: 1000000n,
        mcToken: mcUSDC,
        toChain: paymentChain,
        mode: "OPTIMISTIC"
      }
    )

    expect(instructions.length).toBe(1)
    expect(instructions[0].calls.length).toBe(2)
  })
})
