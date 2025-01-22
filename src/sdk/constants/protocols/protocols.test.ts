import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, test } from "vitest"

import { aave } from "."
import { getTestChains, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"

describe("mee.protocols", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount

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
  })

  test("should have relevant aavev3 properties", async () => {
    const { pool, lpToken, name } = aave

    expect(pool).toBeDefined()
    expect(lpToken).toBeDefined()
    expect(name).toBe("AaveV3")
    expect(pool.abi).toBeDefined()
    expect(lpToken.abi).toBeDefined()
    expect(pool.deployments).toBeDefined()
    expect(lpToken.deployments).toBeDefined()

    expect(pool.deployments).toMatchInlineSnapshot(`
      Map {
        10 => "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        8453 => "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        137 => "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        42161 => "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
      }
    `)

    expect(lpToken.deployments).toMatchInlineSnapshot(`
      Map {
        1 => "0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c",
        100 => "0xc6b7aca6de8a6044e0e32d0c841a89244a10d284",
        10 => "0x625e7708f30ca75bfd92586e17077590c60eb4cd",
        1088 => "0x885c8aec5867571582545f894a5906971db9bf27",
        42161 => "0x724dc807b04555b71ed48a6896b6f41593b8c637",
        137 => "0x625e7708f30ca75bfd92586e17077590c60eb4cd",
        43114 => "0x625e7708f30ca75bfd92586e17077590c60eb4cd",
      }
    `)
  })
})
