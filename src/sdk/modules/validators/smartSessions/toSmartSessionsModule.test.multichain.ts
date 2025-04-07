import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { http, type Chain, type LocalAccount, type Transport } from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import {
  type NetworkConfig,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { killNetwork } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount,
  toNexusAccount
} from "../../../account"
import { createSmartAccountClient } from "../../../clients/createBicoBundlerClient"
import { toSafeSenderCalls } from "../../../clients/decorators/erc7579/installModule"
import { getSudoPolicy } from "../../../constants"
import { smartSessionActions } from "./decorators"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

describe("modules.toSmartSessionsModule.multichain", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })
  })

  test("grant a permission", async () => {
    const smartSessionsModule = toSmartSessionsModule({ signer: eoaAccount })

    // const safeSender = await toSafeSenderCalls({
    // })
    const instructions = []
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
