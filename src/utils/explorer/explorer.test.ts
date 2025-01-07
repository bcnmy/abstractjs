import { anvil } from "viem/chains"
import { describe, test, expect, beforeAll } from "vitest"
import { getExplorerTxLink } from "./explorer"
import type { LocalAccount, PublicClient } from "viem"
import { getBalance, initNetwork } from "../../../tests/config"
import { mcUSDC } from "../../commons/tokens/stablecoins"

describe("explorer", () => {
  let eoa: LocalAccount
  let publicClient: PublicClient

  beforeAll(async () => {
    const network = await initNetwork("ANVIL")
    eoa = network.eoa
    publicClient = network.publicClient
  })

  test("should check balances", async () => {
    const balance = await getBalance(
      publicClient,
      eoa.address,
      mcUSDC.addressOn(anvil.id)
    )
    expect(balance > 0n).toBeTruthy()
  })

  test("should get explorer tx url", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, anvil)
    expect(url).toEqual(`${anvil.blockExplorers?.default.url}/tx/${hash}`)
  })
})
