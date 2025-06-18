import { http } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

describe("mee.getGasTankNonce", () => {
  let gasTankAccount: GasTankAccount

  beforeAll(async () => {
    gasTankAccount = await toGasTankAccount({
      transport: http(),
      chain: baseSepolia,
      privateKey: generatePrivateKey()
    })
  })

  it("Fetch gas tank nonce", async () => {
    const { nonce, nonceKey } = await gasTankAccount.getNonce()

    expect(nonceKey).toBeDefined()
    expect(nonce).toBeDefined()
  })
})
