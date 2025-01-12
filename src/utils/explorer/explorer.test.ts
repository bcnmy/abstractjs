import type { LocalAccount, PublicClient } from "viem"
import { anvil, baseSepolia } from "viem/chains"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { initNetwork, type NetworkConfig } from "../../../tests/config"
import { getExplorerTxLink, getJiffyScanLink, getMeeScanLink } from "./explorer"

describe("explorer", () => {
  let network: NetworkConfig
  let eoa: LocalAccount
  let publicClient: PublicClient

  beforeAll(async () => {
    network = await initNetwork("ANVIL")
    eoa = network.eoa
    publicClient = network.publicClient
  })
  afterAll(async () => await network.anvilInstance?.stop())

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
    const url = getExplorerTxLink(hash, baseSepolia)
    expect(url).toEqual(`${baseSepolia.blockExplorers?.default.url}/tx/${hash}`)
  })
  test("should get a url for a baseSepolia tx by chainId (number)", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, baseSepolia.id)
    expect(url).toEqual(`${baseSepolia.blockExplorers?.default.url}/tx/${hash}`)
  })
  test("should get a url for a baseSepolia tx by chainId (string)", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, String(baseSepolia.id))
    expect(url).toEqual(`${baseSepolia.blockExplorers?.default.url}/tx/${hash}`)
  })
})
