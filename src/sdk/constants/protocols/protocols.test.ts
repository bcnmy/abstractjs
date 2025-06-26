import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test } from "vitest"

import { aave } from "."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"

describe("mee.protocols", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
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
        10 => "0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5",
        8453 => "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
      }
    `)
  })
})
