import { describe, expect, test } from "bun:test"
import { http, type Hash, erc20Abi, zeroAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  bsc,
  optimism,
  optimismSepolia,
  polygon,
  scroll
} from "viem/chains"
import { toMeeCompliantNexusAccount } from "../account-vendors"
import { toMultichainNexusAccount } from "../account-vendors/nexus/multichain-nexus.account"
import { createMeeService } from "../mee.service"
import { signMeeQuote } from "../utils"
import { getMultichainContract } from "../utils/contract/getMultichainContract"
import { supertransaction } from "../utils/syntax/supertransaction-builder.util"
import { buildCall, buildMeeUserOp } from "../workflow"

const PRIV_KEY = Bun.env.TEST_PRIVATE_KEY as Hash

describe("Private key", () => {
  test("should have private key", () => {
    expect(PRIV_KEY).toBeTruthy()
    expect(PRIV_KEY).toStartWith("0x")
  })
})

describe("Nexus Account", async () => {
  const eoa = privateKeyToAccount(PRIV_KEY)

  const mcNexusTestnet = await toMultichainNexusAccount({
    chains: [baseSepolia, optimismSepolia],
    signer: eoa
  })

  const mcNexusMainnet = await toMultichainNexusAccount({
    chains: [optimism, base, polygon, arbitrum, avalanche, scroll, bsc],
    signer: eoa
  })

  test("Mainnets should work", async () => {
    expect(mcNexusMainnet.deployments.length).toEqual(7)
  })

  test("should initialize Nexus account", async () => {
    expect(mcNexusTestnet.deployments.length).toEqual(2)
  })

  test("should be same address on base and optimism", async () => {
    expect(mcNexusTestnet.deploymentOn(baseSepolia.id).address).toEqual(
      mcNexusTestnet.deploymentOn(optimismSepolia.id).address
    )
  })

  const nexus = await toMeeCompliantNexusAccount({
    chain: optimism,
    signer: eoa,
    transport: http()
  })

  test("should initialize single chain MEE Compliant Nexus Account", async () => {
    expect(nexus.address).toStartWith("0x")
  })

  test("Nexus should sign message", async () => {
    const signed = await nexus.signMessage({
      message: {
        raw: "0xABC"
      }
    })
    expect(signed).toStartWith("0x")
  })
})

describe("Reading through MultichainAccount", async () => {
  const eoa = privateKeyToAccount(PRIV_KEY)

  const mcNexus = await toMultichainNexusAccount({
    chains: [optimism, base],
    signer: eoa
  })

  const mcUSDC = getMultichainContract({
    abi: erc20Abi,
    deployments: [
      ["0x0b2c639c533813f4aa9d7837caf62653d097ff85", optimism.id],
      ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", base.id]
    ]
  })

  const readAddress = mcNexus.deploymentOn(optimism.id).address
  const usdcBalanceOnChains = await mcUSDC.read({
    account: mcNexus,
    functionName: "balanceOf",
    args: [readAddress],
    onChains: [optimism, base]
  })

  expect(usdcBalanceOnChains.length).toEqual(2)
})

describe("MEE Service", async () => {
  const eoa = privateKeyToAccount(PRIV_KEY)

  const mcNexus = await toMultichainNexusAccount({
    chains: [optimism, base],
    signer: eoa
  })

  const meeService = createMeeService()

  test("should init meeService", async () => {
    expect(meeService.execute).toBeTruthy()
  })

  const uOp = buildMeeUserOp({
    calls: [{ to: zeroAddress, value: 0n, gasLimit: 50_000n }]
  })

  test("should encode an MEEUserOp", async () => {
    expect(uOp.calls.length).toEqual(1)
  })

  test("should cast PartialMeeUserOp to MeeUserOp", async () => {
    const casted = uOp.on(optimism.id)
    expect(casted.chainId).toEqual(optimism.id)
  })

  test("should build call", () => {
    const data = "0xabc"
    const value = 10n
    const gasLimit = 50_000n

    const call = buildCall({
      gasLimit: gasLimit,
      to: zeroAddress,
      value: value,
      data: data
    })
    expect(call.data).toEqual(data)
    expect(call.value).toEqual(value)
    expect(call.to).toEqual(zeroAddress)
    expect(call.gasLimit).toEqual(gasLimit)
  })

  // The E2E tests are not sufficient, nor good. They depend on having funds
  // on optimism and base and depend on public testnets. A local testing environment
  // needs to be set up. These tests are sufficient while we're in the experimental
  // phase of development.
  test.skip("should get quote", async () => {
    const quote = await supertransaction()
      .injectAccount(mcNexus)
      .payGasWith("USDC", { on: optimism.id })
      .addInstructions(
        buildMeeUserOp({
          calls: {
            to: zeroAddress,
            gasLimit: 50_000n,
            value: 0n
          },
          chainId: base.id
        })
      )
      .getQuote(meeService)

    expect(quote.hash).toStartWith("0x")

    const receipt = await meeService.execute(
      await signMeeQuote({
        executionMode: "direct-to-mee",
        quote: quote,
        signer: eoa
      })
    )

    expect(receipt.hash).toStartWith("0x")
  })
})
