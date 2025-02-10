import {
  http,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  encodeFunctionData
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { CounterAbi } from "../../../test/__contracts/abi/CounterAbi"
import { testAddresses } from "../../../test/callDatas"
import { toNetwork } from "../../../test/testSetup"
import {
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../account/toNexusAccount"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../clients/createBicoBundlerClient"
import { SmartSessionMode } from "../../constants"
import type { Module } from "../utils/Types"
import { parse, stringify } from "./Helpers"
import type { SessionData } from "./Types"
import { smartSessionCreateActions, smartSessionUseActions } from "./decorators"
import { toSmartSessionsValidator } from "./toSmartSessionsValidator"

describe("modules.smartSessions.dx", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let usersNexusClient: NexusClient
  let sessionKeyAccount: LocalAccount
  let sessionPublicKey: Address
  let nexusAccount: NexusAccount
  let stringifiedSessionDatum: string
  let sessionsModule: Module

  beforeAll(async () => {
    network = await toNetwork("BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    sessionKeyAccount = privateKeyToAccount(generatePrivateKey()) // Generally belongs to the dapp
    sessionPublicKey = sessionKeyAccount.address
    testClient = toTestClient(chain, getTestAccount(5))
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  /**
   * This test demonstrates the creation and use of a smart session from two perspectives:
   *
   * 1. User Perspective (first test):
   *    - Create a Nexus client for the user's account
   *    - Install the smart sessions module on the user's account
   *    - Create a smart session with specific permissions
   *
   * 2. Dapp Perspective (second test):
   *    - Simulate a scenario where the user has left the dapp
   *    - Create a new Nexus client using the session key
   *    - Use the session to perform actions on behalf of the user
   *
   * This test showcases how smart sessions enable controlled, delegated actions
   * on a user's smart account, even after the user is no longer actively engaged.
   */
  test("should demonstrate creating a smart session from user's perspective", async () => {
    // User Perspective: Creating and setting up the smart session

    // Create a Nexus client for the main account (eoaAccount)
    // This client will be used to interact with the smart contract account

    nexusAccount = await toNexusAccount({
      chain,
      signer: eoaAccount,
      transport: http(),
      useTestBundler: true
    })

    usersNexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl)
    })

    // Fund the account and deploy the smart contract wallet
    await fundAndDeployClients(testClient, [usersNexusClient])

    // Create a smart sessions module for the user's account
    sessionsModule = toSmartSessionsValidator({
      account: usersNexusClient.account,
      signer: eoaAccount
    })

    // Install the smart sessions module on the Nexus client's smart contract account
    const hash = await usersNexusClient.installModule({
      module: sessionsModule.moduleInitData
    })

    // Wait for the module installation transaction to be mined and check its success
    const { success: installSuccess } =
      await usersNexusClient.waitForUserOperationReceipt({ hash })

    // Extend the Nexus client with smart session creation actions
    const nexusSessionClient = usersNexusClient.extend(
      smartSessionCreateActions(sessionsModule)
    )

    expect(installSuccess).toBe(true)

    // Define the session parameters
    // This includes the session key, validator, and action policies
    const createSessionsResponse = await nexusSessionClient.grantPermission({
      sessionRequestedInfo: [
        {
          sessionPublicKey, // Public key of the session
          // sessionValidUntil: number
          // sessionValidAfter: number
          // chainIds: bigint[]
          actionPoliciesInfo: [
            {
              abi: CounterAbi,
              contractAddress: testAddresses.Counter,
              sudo: true
              // validUntil?: number
              // validAfter?: number
              // valueLimit?: bigint
            }
          ]
        }
      ]
    })

    // Wait for the session creation transaction to be mined and check its success
    const { success: sessionCreateSuccess } =
      await usersNexusClient.waitForUserOperationReceipt({
        hash: createSessionsResponse.userOpHash
      })

    expect(sessionCreateSuccess).toBe(true)

    // Prepare the session data to be stored by the dApp. This could be saved in a Database by the dApp, or client side in local storage.
    const sessionData: SessionData = {
      granter: usersNexusClient.account.address,
      sessionPublicKey,
      description: `Session to increment a counter for ${testAddresses.Counter}`,
      moduleData: {
        permissionIds: createSessionsResponse.permissionIds,
        action: createSessionsResponse.action,
        mode: SmartSessionMode.USE,
        sessions: createSessionsResponse.sessions
      }
    }

    // Zip the session data, and store it for later use by a dapp
    stringifiedSessionDatum = stringify(sessionData)
  }, 200000)

  test("should demonstrate using a smart session from dapp's perspective", async () => {
    // Now assume the user has left the dapp and the usersNexusClient signer is no longer available
    // The following code demonstrates how a dapp can use the session to act on behalf of the user

    // Unzip the session data
    const usersSessionData = parse(stringifiedSessionDatum)

    // Create a new Nexus client for the session
    // This client will be used to interact with the smart contract account using the session key

    const smartSessionNexusAccount = await toNexusAccount({
      accountAddress: usersSessionData.granter,
      chain,
      signer: sessionKeyAccount,
      transport: http(),
      useTestBundler: true
    })

    const smartSessionNexusClient = createSmartAccountClient({
      account: smartSessionNexusAccount,
      transport: http(bundlerUrl)
    })

    // Create a new smart sessions module with the session key
    const usePermissionsModule = toSmartSessionsValidator({
      account: smartSessionNexusClient.account,
      signer: sessionKeyAccount,
      moduleData: usersSessionData.moduleData
    })

    // Extend the session client with smart session use actions
    const useSmartSessionNexusClient = smartSessionNexusClient.extend(
      smartSessionUseActions(usePermissionsModule)
    )

    // Use the session to perform an action (increment and decrement the counter using the same permissionId)
    const userOpHash = await useSmartSessionNexusClient.usePermission({
      calls: [
        {
          to: testAddresses.Counter,
          data: encodeFunctionData({
            abi: CounterAbi,
            functionName: "incrementNumber"
          })
        },
        {
          to: testAddresses.Counter,
          data: encodeFunctionData({
            abi: CounterAbi,
            functionName: "decrementNumber"
          })
        }
      ]
    })

    // Wait for the action to be mined and check its success
    const { success: sessionUseSuccess } =
      await useSmartSessionNexusClient.waitForUserOperationReceipt({
        hash: userOpHash
      })

    expect(sessionUseSuccess).toBe(true)
  }, 200000) // Test timeout set to 60 seconds
})
