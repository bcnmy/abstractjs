import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { http, type Address, type Chain, Hex, type LocalAccount } from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testSetup"
import { getTestAccount, killNetwork } from "../../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import { ownableActions } from "./decorators"
import { toOwnableModule } from "./toOwnableModule"

describe("modules.toOwnableModule", () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let nexusAccount: NexusAccount

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    redeemerAccount = getTestAccount(1)

    const ownablesModule = toOwnableModule({
      signer: eoaAccount,
      threshold: 1,
      owners: [redeemerAccount.address]
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(),
      validators: [ownablesModule]
    })

    nexusClient = createSmartAccountClient({
      bundlerUrl,
      account: nexusAccount
    })
    nexusAccountAddress = await nexusAccount.getAddress()
  })
  afterAll(async () => {
    await killNetwork([network.rpcPort, network.bundlerPort])
  })

  test("demo an ownable account", async () => {
    const ownablesClient = nexusClient.extend(ownableActions())
    const { userOpHash, userOp } = await ownablesClient.prepareForMultiSign({
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: "0x273ea3e3"
        }
      ]
    })
    const sig = await redeemerAccount.signMessage({
      message: { raw: userOpHash }
    })
    const multiSigHash = await ownablesClient.multiSign({
      ...userOp,
      signatures: [sig]
    })

    const receipt = await nexusClient.waitForUserOperationReceipt({
      hash: multiSigHash
    })
    if (!receipt.success) {
      throw new Error("Multi sign failed")
    }

    expect(receipt.success).toBe("true")
  })
})
