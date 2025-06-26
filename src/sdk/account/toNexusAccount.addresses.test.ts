import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient
} from "viem"
import { base, baseSepolia } from "viem/chains"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import {
  MAINNET_RPC_URLS,
  TESTNET_RPC_URLS,
  toNetwork
} from "../../test/testSetup"
import { getTestAccount, killNetwork, toTestClient } from "../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import {
  type NexusClient,
  createSmartAccountClient
} from "../clients/createBicoBundlerClient"
import { type NexusAccount, toNexusAccount } from "./toNexusAccount"

describe("nexus.account.addresses", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let userTwo: LocalAccount
  let nexusAccountAddress: Address
  let nexusClient: NexusClient
  let nexusAccount: NexusAccount
  let walletClient: WalletClient

  beforeAll(async () => {
    network = await toNetwork("BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    userTwo = getTestAccount(1)
    testClient = toTestClient(chain, getTestAccount(5))

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    nexusAccount = await toNexusAccount({
      chain,
      signer: eoaAccount,
      transport: http(network.rpcUrl)
    })

    nexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    nexusAccountAddress = await nexusAccount.getAddress()
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should override account address", async () => {
    const someoneElsesNexusAddress =
      "0xf0479e036343bC66dc49dd374aFAF98402D0Ae5f"

    const newNexusAccount = await toNexusAccount({
      accountAddress: someoneElsesNexusAddress,
      chain,
      signer: eoaAccount,
      transport: http(network.rpcUrl)
    })

    const newNexusClient = createSmartAccountClient({
      account: newNexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const accountAddress = await newNexusClient.account.getAddress()
    const someoneElseCounterfactualAddress =
      await newNexusClient.account.getAddress()
    expect(newNexusClient.account.address).toBe(
      someoneElseCounterfactualAddress
    )
    expect(accountAddress).toBe(someoneElsesNexusAddress)
  })

  test("should check that mainnet and testnet addresses are different", async () => {
    const mainnetClient = createSmartAccountClient({
      account: await toNexusAccount({
        chain: base,
        signer: eoaAccount,
        transport: http(MAINNET_RPC_URLS[base.id])
      }),
      mock: true,
      transport: http(bundlerUrl)
    })

    const testnetClient = createSmartAccountClient({
      account: await toNexusAccount({
        chain: baseSepolia,
        signer: eoaAccount,
        transport: http(TESTNET_RPC_URLS[baseSepolia.id])
      }),
      mock: true,
      transport: http(bundlerUrl)
    })

    const testnetAddress = await testnetClient.account.getAddress()
    const mainnetAddress = await mainnetClient.account.getAddress()

    expect(testnetAddress).toBe(mainnetAddress)
  })
})
