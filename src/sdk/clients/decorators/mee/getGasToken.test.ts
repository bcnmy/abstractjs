import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type { FeeTokenInfo } from "./getQuote"

describe("mee.getGasToken", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should return gas token for valid chain id", async () => {
    const result = await meeClient.getGasToken({
      chainId: 1,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    })
    expect(result.chainId).toBe("1")
    expect(result.paymentTokens.length).toBeGreaterThan(6)
    expect(result.paymentTokens[0].symbol).toBe("ETH")
  })

  test("should throw error for invalid chain id", async () => {
    await expect(
      meeClient.getGasToken({
        chainId: 999,
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
    ).rejects.toThrow("Gas token not found for chain 999")
  })

  test("should throw error for invalid chain id", async () => {
    await expect(
      meeClient.getGasToken({
        chainId: 999,
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
    ).rejects.toThrow("Gas token not found for chain 999")
  })
})
