import {
  http,
  type Account,
  type Address,
  type Chain,
  type LocalAccount
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { ownableActions } from "."
import { toNetwork } from "../../../../test/testSetup"
import {
  type MasterClient,
  type NetworkConfig,
  fundAndDeployClients,
  getBalance,
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
} from "../../../clients/createBicoBundlerClient"
import {
  OWNABLE_VALIDATOR_ADDRESS,
  TEST_ADDRESS_K1_VALIDATOR_ADDRESS,
  TEST_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
} from "../../../constants"
import { toOwnableValidator } from "../toOwnableValidator"

describe("modules.ownables.decorators", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let userThree: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let userThreeAddress: Address
  let recipient: Account
  let recipientAddress: Address
  let nexusAccount: NexusAccount
  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    recipient = getTestAccount(1)
    userThree = getTestAccount(2)
    recipientAddress = recipient.address
    userThreeAddress = userThree.address
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

  test.concurrent("should batch test ownable decorators", async () => {
    const ownableModule = toOwnableValidator({
      account: nexusClient.account,
      signer: eoaAccount,
      moduleInitArgs: {
        threshold: 1,
        owners: [recipientAddress]
      }
    })

    const hash = await nexusClient.installModule({
      module: ownableModule.moduleInitData
    })

    const ownableNexusClient = nexusClient.extend(ownableActions(ownableModule))

    const { success } = await ownableNexusClient.waitForUserOperationReceipt({
      hash
    })

    expect(success).toBe(true)

    const [threshold, owners, addOwnerTx, removeOwnerTx, setThresholdTx] =
      await Promise.all([
        ownableNexusClient.getThreshold(),
        ownableNexusClient.getOwners(),
        ownableNexusClient.getAddOwnerTx({
          owner: userThreeAddress
        }),
        ownableNexusClient.getRemoveOwnerTx({
          owner: recipientAddress
        }),
        ownableNexusClient.getSetThresholdTx({ threshold: 2 })
      ])

    expect(threshold).toBe(1)
    expect(owners).toEqual([recipientAddress])
    expect(addOwnerTx).toHaveProperty("to", OWNABLE_VALIDATOR_ADDRESS)
    expect(removeOwnerTx).toHaveProperty("to", OWNABLE_VALIDATOR_ADDRESS)
    expect(setThresholdTx).toHaveProperty("to", OWNABLE_VALIDATOR_ADDRESS)
  })
})
