import type { LocalAccount, PublicClient } from "viem"
import { anvil, baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { getBalance, initNetwork } from "../../../tests/config"
import { mcUSDC } from "../../commons/tokens"
import { getExplorerTxLink } from "./explorer"

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
      mcUSDC.addressOn(baseSepolia.id) // because anvil was forked from baseSepolia
    )
    expect(balance > 0n).toBeTruthy()
  })

  test("should get explorer tx url", () => {
    const hash = "0x123"
    const url = getExplorerTxLink(hash, anvil)
    expect(url).toEqual(`${anvil.blockExplorers?.default.url}/tx/${hash}`)
  })
})
