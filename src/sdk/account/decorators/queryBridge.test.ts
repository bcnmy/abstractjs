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
import type { MultichainAddressMapping } from "./buildBridgeInstructions"
import { queryBridge } from "./queryBridge"

describe("mee.queryBridge", () => {
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
      depositor: mcNexus.addressOn(paymentChain.id, true),
      recipient: mcNexus.addressOn(targetChain.id, true),
      amount: 1000000n,
      toChainId: targetChain.id,
      fromChainId: paymentChain.id,
      tokenMapping
    })

    expect(payload?.amount).toBeGreaterThan(0n)
    expect(payload?.receivedAtDestination).toBeGreaterThan(0n)
  })
})
