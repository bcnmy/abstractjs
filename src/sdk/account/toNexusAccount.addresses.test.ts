import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
  createWalletClient,
  isHex
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia } from "viem/chains"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../test/testSetup"
import {
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import {
  type NexusClient,
  createSmartAccountClient
} from "../clients/createBicoBundlerClient"
import {
  BICONOMY_ATTESTER_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS,
  TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
} from "../constants"
import { type NexusAccount, toNexusAccount } from "./toNexusAccount"
import { getK1NexusAddress } from "./utils"

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
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    userTwo = getTestAccount(1)
    testClient = toTestClient(chain, getTestAccount(5))

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http()
    })

    nexusAccount = await toNexusAccount({
      chain,
      signer: eoaAccount,
      transport: http()
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
      transport: http()
    })

    const newNexusClient = createSmartAccountClient({
      account: newNexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const accountAddress = await newNexusClient.account.getAddress()
    const someoneElseCounterfactualAddress =
      await newNexusClient.account.getCounterFactualAddress()
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
        transport: http()
      }),
      mock: true,
      transport: http(bundlerUrl)
    })

    const testnetClient = createSmartAccountClient({
      account: await toNexusAccount({
        chain: baseSepolia,
        signer: eoaAccount,
        transport: http()
      }),
      mock: true,
      transport: http(bundlerUrl)
    })

    const testnetAddress = await testnetClient.account.getAddress()
    const mainnetAddress = await mainnetClient.account.getAddress()

    expect(testnetAddress).toBe(mainnetAddress)
  })

  test("should test a mee account", async () => {
    const eoaAccount = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`)

    const meeAccount = await toNexusAccount({
      signer: eoaAccount,
      chain: baseSepolia,
      transport: http()
    })

    const meeAddress = await meeAccount.getAddress()
    const meeCounterfactualAddress = await meeAccount.getCounterFactualAddress()

    expect(isHex(meeAddress)).toBe(true)
    expect(isHex(meeCounterfactualAddress)).toBe(true)
    expect(meeAddress).toBe(meeCounterfactualAddress)
  })
})
