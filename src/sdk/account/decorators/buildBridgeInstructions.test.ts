import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChains, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { mcUSDC } from "../../constants/tokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { toAcrossPlugin } from "../utils/toAcrossPlugin"
import buildBridgeInstructions from "./buildBridgeInstructions"

describe("mee:buildBridgeInstructions", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = createMeeClient({ account: mcNexus })
  })

  it("should call the bridge with a unified balance", async () => {
    const unifiedBalance = await mcNexus.getUnifiedERC20Balance(mcUSDC)
    const payload = await buildBridgeInstructions({
      account: mcNexus,
      amount: 1n,
      bridgingPlugins: [toAcrossPlugin()],
      toChain: targetChain,
      unifiedBalance
    })

    expect(payload).toHaveProperty("meta")
    expect(payload).toHaveProperty("instructions")
    expect(payload.instructions.length).toBeGreaterThan(0)
    expect(payload.meta.bridgingInstructions.length).toBeGreaterThan(0)
    expect(payload.meta.bridgingInstructions[0]).toHaveProperty("userOp")
    expect(payload.meta.bridgingInstructions[0].userOp).toHaveProperty("calls")
    expect(
      payload.meta.bridgingInstructions[0].userOp.calls.length
    ).toBeGreaterThan(0)
  })
})
