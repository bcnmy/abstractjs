import { http } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { TESTNET_RPC_URLS } from "../../../test/testSetup"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

describe("mee.getGasTankNonce", () => {
  let gasTankAccount: GasTankAccount

  beforeAll(async () => {
    gasTankAccount = await toGasTankAccount({
      chainConfiguration: {
        transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
        chain: baseSepolia,
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      },
      privateKey: generatePrivateKey()
    })
  })

  it("Fetch gas tank nonce", async () => {
    const { nonce, nonceKey } = await gasTankAccount.getNonce()

    expect(nonceKey).toBeDefined()
    expect(nonce).toBeDefined()
  })
})
