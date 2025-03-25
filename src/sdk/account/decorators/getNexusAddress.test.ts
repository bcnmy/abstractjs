import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { getDefaultNexusAddress, getK1NexusAddress } from "./getNexusAddress"

describe("account.getNexusAddress", () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let publicClient: PublicClient
  let eoaAccount: LocalAccount

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = network.account!
    publicClient = createPublicClient({
      chain,
      transport: http(network.rpcUrl)
    })
  })

  test.skip("should check k1 nexus address", async () => {
    const customAttesters = [
      "0x1111111111111111111111111111111111111111" as Address,
      "0x2222222222222222222222222222222222222222" as Address
    ]
    const customThreshold = 2
    const customIndex = 5n

    const k1AddressWithParams = await getK1NexusAddress({
      publicClient: publicClient as unknown as PublicClient,
      signerAddress: eoaAccount.address,
      attesters: customAttesters,
      threshold: customThreshold,
      index: customIndex
    })

    expect(k1AddressWithParams).toMatchInlineSnapshot(
      `"0x7a7393640c5075A54Aa72980786AfF9DD59fa7bd"`
    )
  })

  test.skip("should check mee nexus address", async () => {
    const index = 1n

    const meeAddress = await getDefaultNexusAddress({
      publicClient: publicClient as unknown as PublicClient,
      signerAddress: eoaAccount.address
    })

    expect(meeAddress).toMatchInlineSnapshot(
      `"0xf3023A03e18c06Ad625cdFEB5d082b35a108C567"`
    )
  })
})
