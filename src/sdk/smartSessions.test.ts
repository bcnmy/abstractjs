import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { http, type Chain, type Hex, type LocalAccount, parseEther } from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../test/testSetup"
import { getTestAccount, killNetwork, toTestClient } from "../test/testUtils"
import type { MasterClient, NetworkConfig } from "../test/testUtils"
import { toNexusAccount } from "./account/toNexusAccount"
import { createSmartAccountClient } from "./clients/createBicoBundlerClient"
import { SmartSessionMode } from "./constants"
import { type SessionData, parse, stringify } from "./modules"
import { toSmartSessionsValidator } from "./modules/validators/smartSessions/toSmartSessionsValidator"
import {
  smartSessionCreateActions,
  smartSessionUseActions
} from "./modules/validators/smartSessionsValidator/decorators"

describe.skip("smartSessions", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let dappAccount: LocalAccount

  beforeAll(async () => {
    network = await toNetwork("BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    dappAccount = getTestAccount(1)

    testClient = toTestClient(chain, getTestAccount(5))
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should demo a basic smart session usage", async () => {
    const nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    await testClient.setBalance({
      address: nexusAccount.address,
      value: parseEther("1")
    })

    const nexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const hash = await nexusClient.installModule({
      module: toSmartSessionsValidator({ signer: eoaAccount })
    })
    const result = await nexusClient.waitForUserOperationReceipt({ hash })
    expect(result.success).toBe(true)
    const sessionClient = nexusClient.extend(smartSessionCreateActions())

    const sessionPayload = await sessionClient.grantPermission({
      sessionRequestedInfo: [
        {
          sessionPublicKey: dappAccount.address, // session key signer
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

    const sessionData: SessionData = {
      granter: nexusAccount.address,
      sessionPublicKey: dappAccount.address,
      moduleData: { ...sessionPayload, mode: SmartSessionMode.USE }
    }

    const nugget = stringify(sessionData)
    const parsedNugget = parse(nugget)

    const dappNexusAccount = await toNexusAccount({
      accountAddress: parsedNugget.granter,
      signer: dappAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    const dappNexusClient = createSmartAccountClient({
      account: dappNexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const dappSessionClient = dappNexusClient.extend(smartSessionUseActions())

    dappNexusAccount.setModule(
      toSmartSessionsValidator({
        signer: dappAccount,
        moduleData: parsedNugget.moduleData
      })
    )

    const useHash = await dappSessionClient.sendUserOperation({
      calls: [{ to: COUNTER_ADDRESS, data: "0x273ea3e3" }]
    })

    const resultTwo = await dappNexusClient.waitForUserOperationReceipt({
      hash: useHash
    })
    expect(resultTwo.success).toBe(true)
  })
})
