import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  type Chain,
  zeroAddress,
  type LocalAccount,
  isHex,
  isAddress,
  http
} from "viem"
import { base, baseSepolia, optimism, optimismSepolia } from "viem/chains"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { mcUSDC } from "../commons/tokens/stablecoins"
import type { MultichainSmartAccount } from "./account"
import { toMultichainNexusAccount } from "./nexus/multichain-nexus.account"
import { toMeeCompliantNexusAccount } from "./nexus/nexus-mee-compliant"

describe("accounts", async () => {
  let eoa: LocalAccount
  let mcNexusTestnet: MultichainSmartAccount
  let mcNexusMainnet: MultichainSmartAccount

  beforeAll(async () => {
    eoa = privateKeyToAccount(generatePrivateKey())

    mcNexusTestnet = await toMultichainNexusAccount({
      chains: [baseSepolia, optimismSepolia],
      signer: eoa
    })

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, optimism],
      signer: eoa
    })
  })

  test("should have configured accounts correctly", async () => {
    expect(mcNexusMainnet.deployments.length).toEqual(2)
    expect(mcNexusTestnet.deployments.length).toEqual(2)
    expect(mcNexusTestnet.deploymentOn(baseSepolia.id).address).toEqual(
      mcNexusTestnet.deploymentOn(optimismSepolia.id).address
    )
  })

  test("should sign message using MEE Compliant Nexus Account", async () => {
    const nexus = await toMeeCompliantNexusAccount({
      chain: optimism,
      signer: eoa,
      transport: http()
    })

    expect(isAddress(nexus.address)).toBeTruthy()

    const signed = await nexus.signMessage({ message: { raw: "0xABC" } })
    expect(isHex(signed)).toBeTruthy()
  })

  test("should read usdc balance on mainnet", async () => {
    const readAddress = mcNexusMainnet.deploymentOn(optimism.id).address
    const usdcBalanceOnChains = await mcUSDC.read({
      account: mcNexusMainnet,
      functionName: "balanceOf",
      args: [readAddress],
      onChains: [base, optimism]
    })

    expect(usdcBalanceOnChains.length).toEqual(2)
  })
})
