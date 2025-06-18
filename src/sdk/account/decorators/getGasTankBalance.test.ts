import { http, createPublicClient } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { getBalance } from "../../../test/testUtils"
import { testnetMcUSDC } from "../../constants"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

describe("mee.getGasTankBalance", () => {
  let gasTankAccount: GasTankAccount

  beforeAll(async () => {
    gasTankAccount = await toGasTankAccount({
      transport: http(),
      chain: baseSepolia,
      privateKey: generatePrivateKey()
    })
  })

  it("Fetch gas tank balance", async () => {
    const { address: gasTankAddress } = await gasTankAccount.getAddress()

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http()
    })

    const erc20Balance = await getBalance(
      publicClient,
      gasTankAddress,
      testnetMcUSDC.addressOn(baseSepolia.id)
    )

    const { balance, decimals } = await gasTankAccount.getBalance({
      tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id)
    })

    expect(balance).to.eq(erc20Balance)
    expect(decimals).to.eq(6)
  })
})
