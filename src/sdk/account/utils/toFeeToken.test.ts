import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { mcUSDC } from "../../constants/tokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { toFeeToken } from "./toFeeToken"

describe("mee.toFeeToken", () => {
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

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should get a fee token", () => {
    const feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

    expect(feeToken.address).toBe(mcUSDC.addressOn(paymentChain.id))
    expect(feeToken.chainId).toBe(paymentChain.id)
  })
})
