import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { getInfo } from "./getInfo"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"

describe("mee.getInfo", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

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
})
