import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { mcAUSDC, mcUSDC } from "../../constants/tokens"
import { getUnifiedERC20Balance } from "./getUnifiedERC20Balance"

describe("mee.getUnifiedERC20Balance", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

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

    meeClient = await createMeeClient({ account: mcNexus })
  })

  it("should aggregate balances across chains correctly", async () => {
    const unifiedBalance = await getUnifiedERC20Balance({
      account: mcNexus,
      mcToken: mcUSDC
    })

    expect(unifiedBalance.balance).toBeGreaterThan(0n)
    expect(unifiedBalance.breakdown).toHaveLength(2)
    expect(unifiedBalance.decimals).toBe(6)

    expect(unifiedBalance.breakdown[0]).toHaveProperty("balance")
    expect(unifiedBalance.breakdown[0]).toHaveProperty("decimals")
    expect(unifiedBalance.breakdown[0]).toHaveProperty("chainId")
  })
})
