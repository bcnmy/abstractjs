import { http, createPublicClient } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { TESTNET_RPC_URLS } from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import { getBalance } from "../../../test/testUtils"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

describe("mee.getGasTankBalance", () => {
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

  it("Fetch gas tank balance", async () => {
    const { address: gasTankAddress } = await gasTankAccount.getAddress()

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    })

    const erc20Balance = await getBalance(
      publicClient,
      gasTankAddress,
      testnetMcTestUSDCP.addressOn(baseSepolia.id)
    )

    const { balance, decimals } = await gasTankAccount.getBalance({
      tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
    })

    expect(balance).to.eq(erc20Balance)
    expect(decimals).to.eq(6)
  })
})
