import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { http, type Address, type Chain, encodeFunctionData } from "viem"
import type { Hex, LocalAccount } from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { CounterAbi } from "../../../../test/__contracts/abi"
import { toNetwork } from "../../../../test/testSetup"
import {
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../../../test/testUtils"
import {
  type NexusAccount,
  toNexusAccount
} from "../../../account/toNexusAccount"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import { SmartSessionMode } from "../../../constants"
import {
  smartSessionCreateActions,
  smartSessionUseActions
} from "../../../modules/smartSessionsValidator/decorators"
import { toSmartSessionsValidator } from "../../../modules/smartSessionsValidator/toSmartSessionsValidator"
import type { Module } from "../../../modules/utils/Types"

describe("erc7579.decorators.uninstallModule", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let dappAccount: LocalAccount
  let sessionPublicKey: Address
  let nexusAccount: NexusAccount

  let sessionsModule: Module

  beforeAll(async () => {
    network = await toNetwork("BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    dappAccount = getTestAccount(1)
    sessionPublicKey = dappAccount.address

    testClient = toTestClient(chain, getTestAccount(5))

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

    nexusAccountAddress = await nexusAccount.getAddress()

    sessionsModule = toSmartSessionsValidator({
      account: nexusClient.account,
      signer: eoaAccount
    })

    await fundAndDeployClients(testClient, [nexusClient])
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should install, uninstall and install again", async () => {
    const isInstalledBefore = await nexusClient.isModuleInstalled({
      module: sessionsModule.moduleInitData
    })

    expect(isInstalledBefore).toBe(false)

    if (!isInstalledBefore) {
      const hash = await nexusClient.installModule({
        module: sessionsModule.moduleInitData
      })

      const { success: installSuccess } =
        await nexusClient.waitForUserOperationReceipt({ hash })
      expect(installSuccess).toBe(true)
    }

    const isInstalledAfter = await nexusClient.isModuleInstalled({
      module: sessionsModule.moduleInitData
    })

    expect(isInstalledAfter).toBe(true)

    // No going to use the module...
    const granterClient = nexusClient.extend(
      smartSessionCreateActions(sessionsModule)
    )

    const createSessionsResponse = await granterClient.grantPermission({
      sessionRequestedInfo: [
        {
          sessionPublicKey, // dappAccount address
          actionPoliciesInfo: [
            {
              contractAddress: COUNTER_ADDRESS, // counter address
              functionSelector: "0x273ea3e3" as Hex, // function selector for increment count,
              sudo: true
            }
          ]
        }
      ]
    })

    const { success: grantPermissionReceiptSuccess } =
      await nexusClient.waitForUserOperationReceipt({
        hash: createSessionsResponse.userOpHash
      })
    expect(grantPermissionReceiptSuccess).toBe(true)

    const dappClient = createSmartAccountClient({
      account: await toNexusAccount({
        accountAddress: granterClient.account?.address,
        chain,
        signer: dappAccount,
        transport: http()
      }),
      transport: http(bundlerUrl),
      mock: true
    })

    const usePermissionsModule = toSmartSessionsValidator({
      account: dappClient.account,
      signer: dappAccount,
      moduleData: {
        permissionIds: createSessionsResponse.permissionIds,
        action: createSessionsResponse.action,
        mode: SmartSessionMode.USE,
        sessions: createSessionsResponse.sessions
      }
    })

    // Extend the session client with smart session use actions
    const useableDappClient = dappClient.extend(
      smartSessionUseActions(usePermissionsModule)
    )
    const userOpHash = await useableDappClient.usePermission({
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: encodeFunctionData({
            abi: CounterAbi,
            functionName: "incrementNumber"
          })
        }
      ]
    })

    expect(userOpHash).toBeDefined()

    const { success: usePermissionReceiptSuccess } =
      await nexusClient.waitForUserOperationReceipt({
        hash: userOpHash
      })
    expect(usePermissionReceiptSuccess).toBe(true)

    // Successfully used the module, now continue with uninstalling it
    const hash = await nexusClient.uninstallModule({
      module: sessionsModule.moduleInitData
    })

    const { success } = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(success).toBe(true)

    const isInstalledAfterUninstall = await nexusClient.isModuleInstalled({
      module: sessionsModule.moduleInitData
    })
    expect(isInstalledAfterUninstall).toBe(false)

    if (!isInstalledAfterUninstall) {
      const hash = await nexusClient.installModule({
        module: sessionsModule.moduleInitData
      })

      const { success: installSuccess } =
        await nexusClient.waitForUserOperationReceipt({ hash })
      expect(installSuccess).toBe(true)
    }

    const isInstalledAfterReInstall = await nexusClient.isModuleInstalled({
      module: sessionsModule.moduleInitData
    })
    expect(isInstalledAfterReInstall).toBe(true)
  })
})
