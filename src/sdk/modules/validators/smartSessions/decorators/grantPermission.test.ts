import {
  type Ecosystem,
  type Infra,
  toEcosystem,
  toNetwork
} from "@biconomy/ecosystem"
import { http, type Account, type Address, type Chain, type Hex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import {
  type MasterClient,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../../../test/testUtils"
import { toNexusAccount } from "../../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../../clients/createBicoBundlerClient"

describe("modules.smartSessions.grantPermission", () => {
  let ecosystem: Ecosystem
  let infra: Infra
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: Account
  let recipientAccount: Account
  let recipientAddress: Address
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let privKey: Hex

  beforeAll(async () => {
    ecosystem = await toEcosystem()
    infra = ecosystem.infras[0]
    chain = infra.network.chain
    bundlerUrl = infra.bundler.url
    eoaAccount = getTestAccount(0)
    recipientAccount = getTestAccount(1)
    recipientAddress = recipientAccount.address

    testClient = toTestClient(chain, getTestAccount(5))

    privKey = generatePrivateKey()
    const account = privateKeyToAccount(privKey)

    const nexusAccount = await toNexusAccount({
      signer: account,
      chain,
      transport: http()
    })

    nexusClient = createSmartAccountClient({
      bundlerUrl,
      account: nexusAccount,
      mock: true
    })
    nexusAccountAddress = await nexusAccount.getAddress()
  })
  afterAll(async () => {
    await killNetwork([infra.network.rpcPort, infra.bundler.port])
  })

  test("should deploy smart account if not deployed", async () => {})
})
