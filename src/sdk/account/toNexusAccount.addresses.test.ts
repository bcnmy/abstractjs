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
  BICONOMY_EXPERIMENTAL_ATTESTER,
  MEE_VALIDATOR_ADDRESS,
  NEXUS_ACCOUNT_FACTORY,
  RHINESTONE_ATTESTER_ADDRESS,
  TEMP_MEE_ATTESTER_ADDR,
  TEST_ADDRESS_K1_VALIDATOR_ADDRESS,
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
    network = await toNetwork("BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA")

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
      transport: http(),
      validatorAddress: TEST_ADDRESS_K1_VALIDATOR_ADDRESS,
      factoryAddress: TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
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

  test("should check account address", async () => {
    nexusAccountAddress = await nexusClient.account.getCounterFactualAddress()
    const counterfactualAddressFromHelper = await getK1NexusAddress({
      publicClient: testClient as unknown as PublicClient,
      signerAddress: eoaAccount.address,
      index: 0n,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
      threshold: 1,
      factoryAddress: TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
    })
    const gottenAddress = await nexusClient.account.getAddress()
    expect(counterfactualAddressFromHelper).toBe(nexusAccountAddress)
    expect(nexusAccount.address).toBe(nexusAccountAddress)
    expect(nexusAccount.address).toBe(counterfactualAddressFromHelper)
    expect(gottenAddress).toBe(nexusAccountAddress)
  })

  test("should check addresses after fund and deploy", async () => {
    await fundAndDeployClients(testClient, [nexusClient])
    const counterfactualAddressFromHelper = await getK1NexusAddress({
      publicClient: testClient as unknown as PublicClient,
      signerAddress: eoaAccount.address,
      index: 0n,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
      threshold: 1,
      factoryAddress: TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
    })
    const gottenAddress = await nexusClient.account.getAddress()
    expect(counterfactualAddressFromHelper).toBe(nexusAccountAddress)
    expect(nexusAccount.address).toBe(nexusAccountAddress)
    expect(nexusAccount.address).toBe(counterfactualAddressFromHelper)
    expect(gottenAddress).toBe(nexusAccountAddress)
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
      useK1Config: false,
      signer: eoaAccount,
      chain: baseSepolia,
      transport: http(),
      validatorAddress: MEE_VALIDATOR_ADDRESS,
      factoryAddress: NEXUS_ACCOUNT_FACTORY,
      attesters: [TEMP_MEE_ATTESTER_ADDR, BICONOMY_EXPERIMENTAL_ATTESTER],
      validatorInitData: eoaAccount.address
    })

    const meeAddress = await meeAccount.getAddress()
    const meeCounterfactualAddress = await meeAccount.getCounterFactualAddress()

    expect(isHex(meeAddress)).toBe(true)
    expect(isHex(meeCounterfactualAddress)).toBe(true)
    expect(meeAddress).toBe(meeCounterfactualAddress)
  })
})
