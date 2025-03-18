import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { http, type Address, type Chain, type LocalAccount } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { CounterAbi } from "../../../../test/__contracts/abi/CounterAbi"
import { toNetwork } from "../../../../test/testSetup"
import {
  type MasterClient,
  type NetworkConfig,
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../../test/testUtils"
import { toNexusAccount } from "../../../account/toNexusAccount"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import type { CreateSessionDataParams } from "../Types"
import {
  type SmartSessionModule,
  toSmartSessionsValidator
} from "../toSmartSessionsValidator"
import { smartSessionCreateActions, smartSessionUseActions } from "./"

describe("modules.smartSessions.decorators", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let sessionKeyAccount: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let sessionPublicKey: Address
  let sessionRequestedInfo: CreateSessionDataParams[]
  let sessionsModule: SmartSessionModule

  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    sessionKeyAccount = privateKeyToAccount(generatePrivateKey()) // Generally belongs to the dapp
    sessionPublicKey = sessionKeyAccount.address
    testClient = toTestClient(chain, getTestAccount(5))

    nexusClient = createSmartAccountClient({
      account: await toNexusAccount({
        chain,
        signer: eoaAccount,
        transport: http()
      }),
      transport: http(bundlerUrl),
      mock: true
    })

    sessionRequestedInfo = [
      {
        sessionPublicKey, // Public key of the session
        // sessionValidUntil: number
        // sessionValidAfter: number
        // chainIds: bigint[]
        actionPoliciesInfo: [
          {
            abi: CounterAbi,
            contractAddress: COUNTER_ADDRESS
            // validUntil?: number
            // validAfter?: number
            // valueLimit?: bigint
          }
        ]
      }
    ]

    nexusAccountAddress = await nexusClient.account.getCounterFactualAddress()
    await fundAndDeployClients(testClient, [nexusClient])
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should test create smart session decorators", async () => {
    sessionsModule = toSmartSessionsValidator({
      account: nexusClient.account,
      signer: eoaAccount
    })

    const hash = await nexusClient.installModule({
      module: sessionsModule.moduleInitData
    })

    const { success: installSuccess } =
      await nexusClient.waitForUserOperationReceipt({ hash })
    expect(installSuccess).toBe(true)

    const nexusSessionClient = nexusClient.extend(
      smartSessionCreateActions(sessionsModule)
    )

    expect(nexusSessionClient).toBeDefined()
    expect(nexusSessionClient.grantPermission).toBeTypeOf("function")
    expect(nexusSessionClient.grantPermission).toBeTypeOf("function")
  })

  test("should test use smart session decorators", async () => {
    const usePermissionsModule = toSmartSessionsValidator({
      account: nexusClient.account,
      signer: sessionKeyAccount
    })

    const smartSessionNexusClient = createSmartAccountClient({
      account: await toNexusAccount({
        chain,
        signer: sessionKeyAccount,
        transport: http()
      }),
      transport: http(bundlerUrl),
      mock: true
    })

    const nexusSessionClient = smartSessionNexusClient.extend(
      smartSessionUseActions(usePermissionsModule)
    )

    expect(nexusSessionClient).toBeDefined()
    expect(nexusSessionClient.usePermission).toBeTypeOf("function")
  })
})
