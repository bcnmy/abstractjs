import {
  http,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  isHex
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia } from "viem/chains"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../test/testSetup"
import { getTestAccount, killNetwork, toTestClient } from "../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import {
  type NexusClient,
  createSmartAccountClient
} from "../clients/createBicoBundlerClient"
import {
  BICONOMY_ATTESTER_ADDRESS,
  K1_VALIDATOR_FACTORY_ADDRESS,
  MEE_VALIDATOR_ADDRESS,
  NEXUS_ACCOUNT_FACTORY_ADDRESS,
  NEXUS_BOOTSTRAP_ADDRESS,
  NexusBootstrapAbi,
  REGISTRY_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS
} from "../constants"
import { toComposableExecutor } from "../modules/toComposableExecutor"
import { toComposableFallback } from "../modules/toComposableFallback"
import { toEmptyHook } from "../modules/toEmptyHook"
import { toMeeValidator } from "../modules/validators/meeValidator/toMeeValidator"
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
  let initData: Hex

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
      transport: http()
    })

    nexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    // Prepare validator modules
    const validators = [toMeeValidator({ signer: eoaAccount })]
    // Prepare executor modules
    const executors = [toComposableExecutor()]
    // Prepare hook module
    const hook = toEmptyHook()
    // Prepare fallback modules
    const fallbacks = [toComposableFallback()]
    // Format modules to ensure they have the correct structure (module and data properties)
    const formattedValidators = formatModules(validators)
    const formattedExecutors = formatModules(executors)
    const formattedHook = formatModules([hook])[0]
    const formattedFallbacks = formatModules(fallbacks)

    initData = encodeAbiParameters(
      [
        { name: "bootstrap", type: "address" },
        { name: "initData", type: "bytes" }
      ],
      [
        NEXUS_BOOTSTRAP_ADDRESS,
        encodeFunctionData({
          abi: NexusBootstrapAbi,
          functionName: "initNexus",
          args: [
            formattedValidators,
            formattedExecutors,
            formattedHook,
            formattedFallbacks,
            REGISTRY_ADDRESS,
            [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
            1
          ]
        })
      ]
    )

    nexusAccountAddress = await nexusAccount.getAddress()
    console.log({ nexusAccountAddress })
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
})
