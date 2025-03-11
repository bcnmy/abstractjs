import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient
} from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, test } from "vitest"
import { toNetwork } from "../../test/testSetup"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import {
  fundAndDeployClients,
  getTestAccount,
  toTestClient,
  topUp
} from "../../test/testUtils"
import {
  type NexusClient,
  createBicoBundlerClient
} from "../clients/createBicoBundlerClient"
import { MEE_VALIDATOR_ADDRESS } from "../constants"
import { type NexusAccount, toNexusAccount } from "./toNexusAccount"

describe("local anvil network", () => {
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
    eoaAccount = getTestAccount(0)
    testClient = toTestClient(chain, getTestAccount(5))

    nexusAccount = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount
    })

    nexusClient = createBicoBundlerClient({
      mock: true,
      account: nexusAccount,
      transport: http(bundlerUrl)
    })

    nexusAccountAddress = await nexusAccount.getAddress()
    await topUp(testClient, nexusAccountAddress)
  })

  test("JOSEPH init local anvil network", async () => {
    console.log(await testClient.getCode({ address: MEE_VALIDATOR_ADDRESS }))

    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalik.eth,
          value: 0n
        }
      ]
    })

    const tx = await nexusClient.waitForUserOperationReceipt({ hash })
    console.log({ tx })
  })
})

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

  test("JOSEPH init testnet network", async () => {
    console.log(await publicClient.getCode({ address: MEE_VALIDATOR_ADDRESS }))

    const account = await toNexusAccount({
      chain,
      transport: http(),
      signer: eoaAccount
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
    console.log({ tx })
  })
})
