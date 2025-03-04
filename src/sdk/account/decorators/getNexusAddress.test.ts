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

  test("should check k1 nexus address", async () => {
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
      `"0xf5268d33A8F3CB71C7bD653BbE870Eb12723355e"`
    )
  })

  test("should check mee nexus address", async () => {
    const index = 1n

    const meeAddress = await getDefaultNexusAddress({
      publicClient: publicClient as unknown as PublicClient,
      signerAddress: eoaAccount.address
    })

    expect(meeAddress).toMatchInlineSnapshot(
      `"0xc49aAf4Ebe5d6627672ad5b4D96C83AFe4179963"`
    )
  })
})
