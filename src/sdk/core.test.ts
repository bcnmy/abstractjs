import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient,
  parseEther
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../test/testSetup"
import { getTestAccount, killNetwork, toTestClient } from "../test/testUtils"
import type { MasterClient, NetworkConfig } from "../test/testUtils"
import { type NexusAccount, toNexusAccount } from "./account/toNexusAccount"
import {
  type NexusClient,
  createSmartAccountClient
} from "./clients/createBicoBundlerClient"
import { toSmartSessionsModule } from "./modules/validators/smartSessions/toSmartSessionsModule"

describe("core", async () => {
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
      mock: true,
      account: nexusAccount,
      transport: http(bundlerUrl)
    })

    nexusAccount = nexusClient.account
    nexusAccountAddress = await nexusClient.account.getAddress()
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should not be deployed", async () => {
    expect(await nexusAccount.isDeployed()).toBe(false)
  })

  test("should now deploy", async () => {
    await testClient.setBalance({
      address: nexusAccountAddress,
      value: parseEther("1")
    })
    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: nexusAccountAddress,
          value: 0n
        }
      ]
    })
    const receipt = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(receipt.success).toBe(true)
    expect(await nexusAccount.isDeployed()).toBe(true)
  })

  test("should install smart sessions validator", async () => {
    const hash = await nexusClient.installModule({
      module: toSmartSessionsModule({ signer: eoaAccount })
    })
    const receipt = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(receipt.success).toBe(true)
  })
})
