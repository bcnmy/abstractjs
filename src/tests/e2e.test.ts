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
import { type FeeToken, signMeeQuote, type SupportedFeeChainId } from "../utils"
import { supertransaction } from "../utils/syntax/supertransaction-builder.util"
import { buildCall, buildMeeUserOp } from "../workflow"
import { mcUSDC } from "../commons/tokens/stablecoins"

const PRIV_KEY = Bun.env.TEST_PRIVATE_KEY as Hash

const payGasWithParams: [FeeToken, { on: SupportedFeeChainId }] = [
  "USDC",
  { on: optimism.id }
]

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

  test("should sign message using initialized single chain MEE Compliant Nexus Account", async () => {
    const nexus = await toMeeCompliantNexusAccount({
      chain: optimism,
      signer: eoa,
      transport: http()
    })

    expect(nexus.address).toStartWith("0x")
    const signed = await nexus.signMessage({
      message: {
        raw: "0xABC"
      }
    })
    expect(signed).toStartWith("0x")
  })
})

let funded = false
describe("Reading through MultichainAccount", async () => {
  const eoa = privateKeyToAccount(PRIV_KEY)

  const mcNexus = await toMultichainNexusAccount({
    chains: [optimism, base],
    signer: eoa
  })

  const readAddress = mcNexus.deploymentOn(optimism.id).address
  const usdcBalanceOnChains = await mcUSDC.read({
    account: mcNexus,
    functionName: "balanceOf",
    args: [readAddress],
    onChains: [optimism, base]
  })

  const paymentBalance = usdcBalanceOnChains.find(
    (balance) => balance.chainId === payGasWithParams[1].on
  )
  if (paymentBalance?.result && paymentBalance.result !== 0n) {
    funded = true
  }

  console.log({ funded })
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
  test.if(funded)("should get quote", async () => {
    const quote = await supertransaction()
      .injectAccount(mcNexus)
      .payGasWith(...payGasWithParams)
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
