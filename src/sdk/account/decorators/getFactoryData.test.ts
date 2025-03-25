import {
  http,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type Transport,
  type WalletClient,
  createWalletClient
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import {
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../../test/testUtils"
import {
  BICONOMY_ATTESTER_ADDRESS,
  MEE_VALIDATOR_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS
} from "../../constants"
import type { NexusAccount } from "../toNexusAccount"
import { getDefaultFactoryData, getK1FactoryData } from "./getFactoryData"

describe("nexus.account.getFactoryData", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let nexusAccount: NexusAccount
  let walletClient: WalletClient
  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = network.account!
    testClient = toTestClient(chain, getTestAccount(5))
    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http()
    })
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test.skip("should check factory data", async () => {
    const factoryData = await getK1FactoryData({
      signerAddress: eoaAccount.address,
      index: 0n,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
      attesterThreshold: 1
    })

    expect(factoryData).toMatchInlineSnapshot(
      `"0x0d51f0b70000000000000000000000000382fe477878c8c3807ab427d0db282effa01cd60000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000333034e9f539ce08819e12c1b8cb29084d000000000000000000000000f9ff902cdde729b47a4cdb55ef16df3683a04eab"`
    )
  })

  test.skip("should check factory data with mee", async () => {
    const factoryData = await getDefaultFactoryData({
      validatorInitData: eoaAccount.address,
      index: 0n,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
      attesterThreshold: 1,
      validatorAddress: MEE_VALIDATOR_ADDRESS,
      publicClient: testClient as unknown as PublicClient,
      walletClient
    })

    expect(factoryData).toMatchInlineSnapshot(
      `"0xea6d13ac0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000879fa30248eeb693dcce3ea94a743622170a36580000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000014401fe9ff2000000000000000000000000fbcbf8314de6da57ea2bc4710115f5271041ca5000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000069e2a187aeffb852bf3ccdc95151b200000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000140382fe477878c8c3807ab427d0db282effa01cd60000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000333034e9f539ce08819e12c1b8cb29084d000000000000000000000000f9ff902cdde729b47a4cdb55ef16df3683a04eab00000000000000000000000000000000000000000000000000000000"`
    )
  })
})
