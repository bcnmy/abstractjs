import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient,
  parseEther
} from "viem"
import { beforeAll, describe, test } from "vitest"
import { toNetwork } from "../../test/testSetup"
import type { NetworkConfig } from "../../test/testUtils"
import { createBicoBundlerClient } from "../clients/createBicoBundlerClient"
import { ENTRY_POINT_ADDRESS } from "../constants"
import { toNexusAccount } from "./toNexusAccount"

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

  test("JOSEPH", async () => {
    const account = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount
    })

    const nexusClient = createBicoBundlerClient({
      account,
      transport: http(bundlerUrl)
    })

    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: "0x0000000000000000000000000000000000000000",
          value: parseEther("1")
        }
      ]
    })
    console.log({ hash })
  })
})
