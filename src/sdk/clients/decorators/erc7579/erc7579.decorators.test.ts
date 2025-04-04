import {
  http,
  type Account,
  type Address,
  type Chain,
  encodePacked,
  isHex
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../../test/testSetup"
import {
  type MasterClient,
  type NetworkConfig,
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../../test/testUtils"
import {
  type NexusAccount,
  toNexusAccount
} from "../../../account/toNexusAccount"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../createBicoBundlerClient"

describe("erc7579.decorators", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: Account
  let nexusAccount: NexusAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let recipient: Account
  let recipientAddress: Address

  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    recipient = getTestAccount(1)
    recipientAddress = recipient.address
    testClient = toTestClient(chain, getTestAccount(5))

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

    nexusAccountAddress = await nexusClient.account.getAddress()
    await fundAndDeployClients(testClient, [nexusClient])
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test.skip("should test read methods", async () => {
    const [
      installedValidators,
      installedExecutors,
      activeHook,
      fallbackSelector,
      supportsValidator,
      supportsDelegateCall,
      isK1ValidatorInstalled
    ] = await Promise.all([
      nexusClient.getInstalledValidators(),
      nexusClient.getInstalledExecutors(),
      nexusClient.getActiveHook(),
      nexusClient.getFallbackBySelector({ selector: "0xcb5baf0f" }),
      nexusClient.supportsModule({ type: "validator" }),
      nexusClient.supportsExecutionMode({ type: "delegatecall" }),
      nexusClient.isModuleInstalled({
        module: {
          type: "validator",
          address: nexusClient.account.getModule().address,
          initData: "0x"
        }
      })
    ])

    expect(installedExecutors[0].length).toBeTypeOf("number")
    expect(installedValidators[0]).toEqual([
      nexusClient.account.getModule().address
    ])
    expect(isHex(activeHook)).toBe(true)
    expect(fallbackSelector.length).toBeTypeOf("number")
    expect(supportsValidator).toBe(true)
    expect(supportsDelegateCall).toBe(true)
    expect(isK1ValidatorInstalled).toBe(true)
    expect([
      installedValidators,
      installedExecutors,
      activeHook,
      fallbackSelector,
      supportsValidator,
      supportsDelegateCall,
      isK1ValidatorInstalled
    ]).toMatchInlineSnapshot(`
      [
        [
          [
            "0x00000000d12897DDAdC2044614A9677B191A2d95",
          ],
          "0x0000000000000000000000000000000000000001",
        ],
        [
          [
            "0x7454C587FCDe26C62deDCFa53548A827CFeB7F78",
          ],
          "0x0000000000000000000000000000000000000001",
        ],
        "0x0000000000000000000000000000000000000000",
        [
          "0x00",
          "0x0000000000000000000000000000000000000000",
        ],
        true,
        true,
        true,
      ]
    `)
  })
})
