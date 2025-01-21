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
import type { MultichainAddressMapping } from "./buildBridgeInstructions"
import { queryBridge } from "./queryBridge"

describe("mee:queryBridge", () => {
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

  it("should query the bridge", async () => {
    const unifiedBalance = await mcNexus.getUnifiedERC20Balance(mcUSDC)

    const tokenMapping: MultichainAddressMapping = {
      on: (chainId: number) =>
        unifiedBalance.mcToken.deployments.get(chainId) || "0x",
      deployments: Array.from(
        unifiedBalance.mcToken.deployments.entries(),
        ([chainId, address]) => ({ chainId, address })
      )
    }

    const payload = await queryBridge({
      account: mcNexus,
      amount: 18600927n,
      toChain: targetChain,
      fromChain: paymentChain,
      tokenMapping
    })

    expect(payload?.amount).toBeGreaterThan(0n)
    expect(payload?.receivedAtDestination).toBeGreaterThan(0n)
  })
})
