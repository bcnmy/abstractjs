import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import {
  type GetInfoPayload,
  getGasTokenByChainId,
  getInfo,
  getPaymentTokenByChainId
} from "./getInfo"
import type { FeeTokenInfo } from "./getQuote"

describe("mee.getInfo", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  const mockInfoTwo: GetInfoPayload = {
    version: "1.0.0",
    node: "test-node",
    supported_chains: [],
    supported_wallet_providers: [],
    supported_gas_tokens: [
      {
        chainId: "1",
        paymentTokens: [
          {
            name: "USD Coin",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            symbol: "USDC",
            decimals: 6,
            permitEnabled: true
          }
        ]
      }
    ]
  }

  const mockInfoOne: GetInfoPayload = {
    version: "1.0.0",
    node: "test-node",
    supported_chains: [],
    supported_wallet_providers: [],
    supported_gas_tokens: [
      {
        chainId: "1",
        paymentTokens: [
          {
            name: "USD Coin",
            address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            symbol: "USDC",
            decimals: 6,
            permitEnabled: true
          }
        ]
      }
    ]
  }

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should get info from meeNode", async () => {
    const info = await getInfo(meeClient)

    const supportedChains = info.supported_chains.flatMap(({ chainId }) =>
      Number(chainId)
    )

    const providerNames = info.supported_wallet_providers.flatMap(
      ({ walletProvider }) => walletProvider
    )

    const tokenSymbols = info.supported_gas_tokens.flatMap(
      ({ paymentTokens }) => paymentTokens.map(({ symbol }) => symbol)
    )

    expect(supportedChains.length).toBeGreaterThan(0)
    expect(supportedChains).toContain(paymentChain.id)
    expect(supportedChains).toContain(targetChain.id)

    expect(info.supported_gas_tokens.length).toBeGreaterThan(0)
    expect(info.supported_wallet_providers.length).toBeGreaterThan(0)

    expect(providerNames).toContain("BICO_V2")
    expect(tokenSymbols).toContain("USDC")
  })

  test("should return gas token for valid chain id", () => {
    const result = getGasTokenByChainId({
      info: mockInfoOne,
      targetChainId: 1
    })
    expect(result.chainId).toBe("1")
    expect(result.paymentTokens).toHaveLength(1)
    expect(result.paymentTokens[0].symbol).toBe("USDC")
  })

  test("should throw error for invalid chain id", () => {
    expect(() =>
      getGasTokenByChainId({ info: mockInfoOne, targetChainId: 999 })
    ).toThrow("Gas token not found for chain 999")
  })

  test("should return payment token for valid chain id and address", () => {
    const result = getPaymentTokenByChainId({
      info: mockInfoTwo,
      targetTokenData: {
        chainId: 1,
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
      }
    })
    expect(result.symbol).toBe("USDC")
    expect(result.address).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
  })

  test("should throw error for invalid address", () => {
    expect(() =>
      getPaymentTokenByChainId({
        info: mockInfoTwo,
        targetTokenData: {
          chainId: 1,
          address: "0x1234567890123456789012345678901234567890"
        }
      })
    ).toThrow(
      "Payment token not found for chain 1 and address 0x1234567890123456789012345678901234567890"
    )
  })

  test("should throw error for invalid chain id", () => {
    expect(() =>
      getPaymentTokenByChainId({
        info: mockInfoTwo,
        targetTokenData: {
          chainId: 999,
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        }
      })
    ).toThrow("Gas token not found for chain 999")
  })
})
