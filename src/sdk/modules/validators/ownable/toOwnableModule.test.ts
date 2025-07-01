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
  Hex,
  type LocalAccount,
  getAbiItem,
  parseEther,
  toFunctionSelector
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { getTestAccount, killNetwork } from "../../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import { CounterAbi } from "../../../constants/abi/CounterAbi"
import { ownableActions } from "./decorators"
import { toOwnableModule } from "./toOwnableModule"

describe("modules.toOwnableModule", () => {
  let ecosystem: Ecosystem
  let infra: Infra
  let chain: Chain
  let bundlerUrl: string

  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let nexusAccount: NexusAccount
  let sessionDetails: string

  beforeAll(async () => {
    ecosystem = await toEcosystem()
    infra = ecosystem.infras[0]
    chain = infra.network.chain
    bundlerUrl = infra.bundler.url
    eoaAccount = getTestAccount(0)
    redeemerAccount = getTestAccount(1)

    const { testClient } = await toClients(infra.network)

    const ownablesModule = toOwnableModule({
      signer: eoaAccount,
      threshold: 1,
      owners: [redeemerAccount.address]
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(infra.network.rpcUrl),
      validators: [ownablesModule]
    })

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

  test("demo an ownable account", async () => {
    const ownablesClient = nexusClient.extend(ownableActions())
    const { userOpHash, userOp } = await ownablesClient.prepareForMultiSign({
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          )
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

    expect(receipt.success).toBe(true)
  })
})
