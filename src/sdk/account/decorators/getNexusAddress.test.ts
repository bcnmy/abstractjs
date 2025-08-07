import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import type { MasterClient, NetworkConfig } from "../../../test/testUtils"
import { getTestAccount, toTestClient, topUp } from "../../../test/testUtils"
import {
  type NexusClient,
  createBicoBundlerClient
} from "../../clients/createBicoBundlerClient"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { type NexusAccount, toNexusAccount } from "../toNexusAccount"

describe("account.decorators.getNexusAddress.local", () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount

  let nexusAccount: NexusAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address

  beforeAll(async () => {
    network = await toNetwork("BESPOKE_ANVIL_NETWORK")
    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`)
    testClient = toTestClient(chain, getTestAccount(5))

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain,
        transport: http(network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    nexusClient = createBicoBundlerClient({
      mock: true,
      account: nexusAccount,
      transport: http(bundlerUrl)
    })

    nexusAccountAddress = await nexusAccount.getAddress()
    await topUp(testClient, nexusAccountAddress)
  })

  test("init local anvil network", async () => {
    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth,
          value: 0n
        }
      ]
    })

    const tx = await nexusClient.waitForUserOperationReceipt({ hash })
  })
})

describe("account.decorators.getNexusAddress.testnet", () => {
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

  test("init testnet network", async () => {
    const account = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain,
        transport: http(network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const nexusClient = createBicoBundlerClient({
      account,
      transport: http(
        `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`
      )
    })

    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth,
          value: 0n
        }
      ]
    })

    const tx = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(tx.success).toBeTruthy()
  })
})
