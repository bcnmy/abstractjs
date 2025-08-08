import { http, isAddress } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { TESTNET_RPC_URLS } from "../../../test/testSetup"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

describe("mee.getGasTankAddress", () => {
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

  it("Fetch Gas tank address", async () => {
    const { address: gasTankAddress } = await gasTankAccount.getAddress()
    expect(true).to.eq(isAddress(gasTankAddress))
  })
})
