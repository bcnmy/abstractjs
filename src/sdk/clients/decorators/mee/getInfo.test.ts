import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { addressEquals } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { getGasToken } from "./getGasToken"
import getInfo from "./getInfo"
import { getPaymentToken } from "./getPaymentToken"
import type { FeeTokenInfo } from "./getQuote"

describe("mee.getInfo", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  const index = 84n // Randomly chosen index

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
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should get info from meeNode", async () => {
    const info = await getInfo(meeClient)

    const supportedChains = info.supportedChains.flatMap(({ chainId }) =>
      Number(chainId)
    )

    const tokenSymbols = info.supportedGasTokens.flatMap(({ paymentTokens }) =>
      paymentTokens.map(({ symbol }) => symbol)
    )

    expect(supportedChains.length).toBeGreaterThan(0)
    expect(supportedChains).toContain(paymentChain.id)
    expect(supportedChains).toContain(targetChain.id)

    expect(info.supportedGasTokens.length).toBeGreaterThan(0)

    expect(tokenSymbols).toContain("USDC")
  })

  test("should return gas token for valid chain id", async () => {
    const result = await getGasToken(meeClient, {
      chainId: 1,
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    })
    expect(result.chainId).toBe("1")
    expect(result.paymentTokens.length).toBeGreaterThan(6)
    expect(result.paymentTokens[0].symbol).toBe("ETH")
  })

  test("should throw error for invalid chain id", async () => {
    await expect(
      getGasToken(meeClient, {
        chainId: 999,
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
    ).rejects.toThrow("Gas token not found for chain 999")
  })

  test("should return payment token for valid chain id and address", async () => {
    const result = await getPaymentToken(meeClient, {
      chainId: 1,
      tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    })
    expect(result.symbol).toBe("USDC")
    expect(
      addressEquals(
        result.address,
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      )
    ).toBe(true)
  })

  test("should throw error for invalid address", async () => {
    await expect(
      getPaymentToken(meeClient, {
        chainId: 1,
        tokenAddress: "0x1234567890123456789012345678901234567890"
      })
    ).rejects.toThrow(
      "Payment token not found for chain 1 and address 0x1234567890123456789012345678901234567890"
    )
  })

  test("should throw error for invalid chain id", async () => {
    await expect(
      getPaymentToken(meeClient, {
        chainId: 999,
        tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      })
    ).rejects.toThrow("Gas token not found for chain 999")
  })
})
