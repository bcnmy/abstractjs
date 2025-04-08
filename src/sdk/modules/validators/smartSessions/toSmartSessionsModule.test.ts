import {
  COUNTER_ADDRESS,
  type Ecosystem,
  type Infra,
  toClients,
  toEcosystem
} from "@biconomy/ecosystem"
import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient,
  parseEther
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { getTestAccount, killNetwork } from "../../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import { getSudoPolicy } from "../../../constants"
import { smartSessionActions } from "./decorators"
import type { GrantPermissionResponse } from "./decorators/grantPermission"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

describe("modules.toSmartSessionsModule", () => {
  let ecosystem: Ecosystem
  let infra: Infra
  let chain: Chain
  let bundlerUrl: string

  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount
  let redeemerAddress: Address
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let nexusAccount: NexusAccount
  let sessionDetails: GrantPermissionResponse
  let publicClient: PublicClient

  beforeAll(async () => {
    ecosystem = await toEcosystem()
    infra = ecosystem.infras[0]
    chain = infra.network.chain
    bundlerUrl = infra.bundler.url
    eoaAccount = getTestAccount(0)
    redeemerAccount = getTestAccount(1)
    redeemerAddress = redeemerAccount.address

    publicClient = createPublicClient({
      chain,
      transport: http(infra.network.rpcUrl)
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(infra.network.rpcUrl)
    })

    const { testClient } = await toClients(infra.network)

    nexusClient = createSmartAccountClient({
      bundlerUrl,
      account: nexusAccount,
      mock: true
    })
    nexusAccountAddress = await nexusAccount.getAddress()
    await testClient.setBalance({
      address: nexusAccountAddress,
      value: parseEther("100")
    })
  })
  afterAll(async () => {
    await killNetwork([infra.network.rpcPort, infra.bundler.port])
  })

  test("grant a permission", async () => {
    const smartSessionsModule = toSmartSessionsModule({ signer: eoaAccount })

    // Install the smart sessions module on the Nexus client's smart contract account
    const hash = await nexusClient.installModule({
      module: smartSessionsModule
    })

    // Wait for the module installation transaction to be mined and check its success
    const { success: installSuccess } =
      await nexusClient.waitForUserOperationReceipt({ hash })

    expect(installSuccess).toBe(true)

    const smartSessionsClient = nexusClient.extend(smartSessionActions())

    sessionDetails = await smartSessionsClient.grantPermission({
      redeemer: redeemerAddress,
      actions: [
        {
          actionTarget: COUNTER_ADDRESS,
          actionTargetSelector: "0x273ea3e3",
          actionPolicies: [getSudoPolicy()]
        }
      ]
    })
  })

  test("use a permission", async () => {
    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chain,
      transport: http(infra.network.rpcUrl)
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashOne = await smartSessionsClient.usePermission({
      sessionDetails,
      calls: [{ to: COUNTER_ADDRESS, data: "0x273ea3e3" }],
      mode: "ENABLE_AND_USE"
    })
    const receiptOne = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHashOne
    })
    if (!receiptOne.success) {
      throw new Error("Smart sessions module validation failed")
    }
  })

  test("use a permission a second time", async () => {
    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chain,
      transport: http(infra.network.rpcUrl)
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashTwo = await smartSessionsClient.usePermission({
      sessionDetails,
      calls: [{ to: COUNTER_ADDRESS, data: "0x273ea3e3" }],
      mode: "USE"
    })

    const receiptTwo = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHashTwo
    })
    expect(receiptTwo.success).toBe(true)
  })
})
