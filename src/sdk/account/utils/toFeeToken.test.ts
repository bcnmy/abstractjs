import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
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

describe("mee.toFeeToken", () => {
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

  test("should get a fee token", () => {
    const feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    expect(feeToken.address).toBe(mcUSDC.addressOn(paymentChain.id))
    expect(feeToken.chainId).toBe(paymentChain.id)
  })
})
