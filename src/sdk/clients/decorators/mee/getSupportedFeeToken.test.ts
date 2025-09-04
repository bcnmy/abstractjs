import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { addressEquals } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { getInfo } from "./getInfo"
import type { FeeTokenInfo } from "./getQuote"

describe("mee.getSupportedFeeToken", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
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
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

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

  test("should get info from meeNode", async () => {
    const info = await getInfo(meeClient)

    const supportedChains = info.supportedChains.flatMap(({ chainId }) =>
      Number(chainId)
    )

    const tokenSymbols = info.supportedGasTokens.flatMap(
      ({ paymentTokens: supportedFeeTokens }) =>
        supportedFeeTokens.map(({ symbol }) => symbol)
    )

    expect(supportedChains.length).toBeGreaterThan(0)
    expect(supportedChains).toContain(paymentChain.id)
    expect(supportedChains).toContain(targetChain.id)

    expect(info.supportedGasTokens.length).toBeGreaterThan(0)

    expect(tokenSymbols).toContain("USDC")
  })

  test("should return payment token and arbitrary token payment info for valid chain id and address", async () => {
    const supportedFeeTokenInfo = await meeClient.getSupportedFeeToken({
      chainId: 1,
      tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    })

    expect(supportedFeeTokenInfo.isArbitraryFeeTokensSupported).to.be.oneOf([
      true,
      false,
      null,
      undefined
    ])

    expect(supportedFeeTokenInfo.supportedFeeToken).not.to.be.oneOf([
      undefined,
      null
    ])

    if (supportedFeeTokenInfo.supportedFeeToken) {
      expect(supportedFeeTokenInfo.supportedFeeToken.symbol).toBe("USDC")
      expect(
        addressEquals(
          supportedFeeTokenInfo.supportedFeeToken.address,
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
        )
      ).toBe(true)
    }
  })
})
