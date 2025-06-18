import {
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
  parseEther
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { getTestAccount, killNetwork } from "../../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import type { Validator } from "../toValidator"
import { toLegacyK1Module } from "./toLegacyK1Module"

describe("modules.toLegacyK1Module", () => {
  let ecosystem: Ecosystem
  let infra: Infra
  let chain: Chain
  let bundlerUrl: string

  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let nexusAccount: NexusAccount
  let legacyK1Module: Validator

  beforeAll(async () => {
    ecosystem = await toEcosystem()
    infra = ecosystem.infras[0]
    chain = infra.network.chain
    bundlerUrl = infra.bundler.url
    eoaAccount = getTestAccount(0)
    redeemerAccount = getTestAccount(1)

    const { testClient } = await toClients(infra.network)

    legacyK1Module = toLegacyK1Module({
      signer: eoaAccount,
      module: "0x0000002D6DB27c52E3C11c1Cf24072004AC75cBa"
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http()
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
    await killNetwork([infra?.network?.rpcPort, infra?.bundler?.port])
  })

  test("should have a consistent snapshot", async () => {
    expect(legacyK1Module).toMatchInlineSnapshot(`
      {
        "address": "0x0000002D6DB27c52E3C11c1Cf24072004AC75cBa",
        "data": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "deInitData": "0x",
        "getStubSignature": [Function],
        "initData": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "module": "0x0000002D6DB27c52E3C11c1Cf24072004AC75cBa",
        "signMessage": [Function],
        "signUserOpHash": [Function],
        "signer": {
          "address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          "getHdKey": [Function],
          "nonceManager": undefined,
          "publicKey": "0x048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5",
          "sign": [Function],
          "signAuthorization": [Function],
          "signMessage": [Function],
          "signTransaction": [Function],
          "signTypedData": [Function],
          "source": "hd",
          "type": "local",
        },
        "type": "validator",
      }
    `)
  })

  test("should generate a valid signature", async () => {
    const signature = await legacyK1Module.signer.signMessage({
      message: "test"
    })
    expect(signature).toMatchInlineSnapshot(
      `"0xf755d9a72d5b7386765e7f0e833af68795b739a267122dae933f41b781b5aed0626ce3263308ebd4c37bed84319b66da2794368771046825bd89b98ba68c4e871b"`
    )
  })
})
