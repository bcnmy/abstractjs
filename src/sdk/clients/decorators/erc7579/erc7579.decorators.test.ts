import {
  http,
  type Account,
  type Address,
  type Chain,
  encodePacked,
  isHex
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import mockAddresses from "../../../../test/__contracts/mockAddresses"
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
  TEST_ADDRESS_K1_VALIDATOR_ADDRESS,
  TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
} from "../../../constants"
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
      transport: http(),
      validatorAddress: TEST_ADDRESS_K1_VALIDATOR_ADDRESS,
      factoryAddress: TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
    })

    nexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    nexusAccountAddress = await nexusClient.account.getCounterFactualAddress()
    await fundAndDeployClients(testClient, [nexusClient])
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test.concurrent("should test read methods", async () => {
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
          address: TEST_ADDRESS_K1_VALIDATOR_ADDRESS,
          initData: "0x"
        }
      })
    ])

    expect(installedExecutors[0].length).toBeTypeOf("number")
    expect(installedValidators[0]).toEqual([TEST_ADDRESS_K1_VALIDATOR_ADDRESS])
    expect(isHex(activeHook)).toBe(true)
    expect(fallbackSelector.length).toBeTypeOf("number")
    expect(supportsValidator).toBe(true)
    expect(supportsDelegateCall).toBe(true)
    expect(isK1ValidatorInstalled).toBe(true)
  })

  test("should install a module", async () => {
    const hash = await nexusClient.installModule({
      module: {
        type: "validator",
        address: mockAddresses.MockValidator,
        initData: encodePacked(["address"], [eoaAccount.address])
      }
    })

    const { success } = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(success).toBe(true)
  })

  test("should uninstall a module", async () => {
    const hash = await nexusClient.uninstallModule({
      module: {
        type: "validator",
        address: mockAddresses.MockValidator,
        initData: encodePacked(["address"], [eoaAccount.address])
      }
    })

    const { success } = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(success).toBe(true)
  })

  test("should install it again", async () => {
    const hash = await nexusClient.installModule({
      module: {
        type: "validator",
        address: mockAddresses.MockValidator,
        initData: encodePacked(["address"], [eoaAccount.address])
      }
    })

    const { success } = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(success).toBe(true)
  })
})
