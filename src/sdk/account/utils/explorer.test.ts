import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { getExplorerTxLink, getJiffyScanLink, getMeeScanLink } from "./explorer"

describe("mee.explorer", () => {
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

    meeClient = createMeeClient({ account: mcNexus })
  })

  test("should get a meescan url", () => {
    const hash = "0x123"
    const url = getMeeScanLink(hash)
    expect(url).toEqual(`https://meescan.biconomy.io/details/${hash}`)
  })

  test("should get a jiffyscan url", () => {
    const hash = "0x123"
    const url = getJiffyScanLink(hash)
    expect(url).toEqual(`https://v2.jiffyscan.xyz/tx/${hash}`)
  })

  test("should get a url for a baseSepolia tx", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, targetChain)
    expect(url).toEqual(`${targetChain.blockExplorers?.default.url}/tx/${hash}`)
  })
  test("should get a url for a baseSepolia tx by chainId (number)", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, targetChain.id)
    expect(url).toEqual(`${targetChain.blockExplorers?.default.url}/tx/${hash}`)
  })
  test("should get a url for a baseSepolia tx by chainId (string)", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, String(targetChain.id))
    expect(url).toEqual(`${targetChain.blockExplorers?.default.url}/tx/${hash}`)
  })
})
