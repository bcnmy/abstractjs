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
  RHINESTONE_ATTESTER_ADDRESS
} from "../../constants"
import type { NexusAccount } from "../toNexusAccount"
import { getK1FactoryData } from "./getFactoryData"

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

  test("should check factory data", async () => {
    const factoryData = await getK1FactoryData({
      signerAddress: eoaAccount.address,
      index: 0n,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
      attesterThreshold: 1
    })

    expect(factoryData).toMatchInlineSnapshot(
      `"0x0d51f0b70000000000000000000000003079b249dfde4692d7844aa261f8cf7d927a0da50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000333034e9f539ce08819e12c1b8cb29084d000000000000000000000000f9ff902cdde729b47a4cdb55ef16df3683a04eab"`
    )
  })
})
