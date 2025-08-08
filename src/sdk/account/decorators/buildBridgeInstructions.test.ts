import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { mcUSDC } from "../../constants/tokens"
import { getMEEVersion } from "../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { toAcrossPlugin } from "../utils/toAcrossPlugin"
import buildBridgeInstructions from "./buildBridgeInstructions"

describe("mee.buildBridgeInstructions", () => {
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

  it("should call the bridge with a unified balance", async () => {
    const unifiedBalance = await mcNexus.getUnifiedERC20Balance(mcUSDC)
    const payload = await buildBridgeInstructions({
      account: mcNexus,
      amount: 100000n,
      bridgingPlugins: [toAcrossPlugin()],
      toChain: targetChain,
      unifiedBalance
    })

    expect(payload).toHaveProperty("meta")
    expect(payload).toHaveProperty("instructions")

    expect([0, 1]).toContain(payload.instructions.length)
    if (payload.instructions.length === 0) return
    expect(payload.instructions.length).toBeGreaterThan(0)
    expect(payload.meta.bridgingInstructions.length).toBeGreaterThan(0)
    expect(payload.meta.bridgingInstructions[0]).toHaveProperty("userOp")
    expect(payload.meta.bridgingInstructions[0].userOp).toHaveProperty("calls")
    expect(
      payload.meta.bridgingInstructions[0].userOp.calls.length
    ).toBeGreaterThan(0)
  })
})
