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
  parseEther,
  createWalletClient
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { getTestAccount, killNetwork } from "../../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { getMEEVersion } from "../smartSessions"
import type { Validator } from "../toValidator"
import { toDefaultModule } from "./toDefaultModule"

describe("modules.toDefaultModule", () => {
  let ecosystem: Ecosystem
  let infra: Infra
  let chain: Chain
  let bundlerUrl: string

  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let nexusAccount: NexusAccount
  let meeModule: Validator

  beforeAll(async () => {
    ecosystem = await toEcosystem()
    infra = ecosystem.infras[0]
    chain = infra.network.chain
    bundlerUrl = infra.bundler.url
    eoaAccount = getTestAccount(0)
    redeemerAccount = getTestAccount(1)

    const { testClient } = await toClients(infra.network)

    meeModule = toDefaultModule({
      walletClient: createWalletClient({
        account: eoaAccount,
        chain,
        transport: http(infra.network.rpcUrl)
      })
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
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
    // Extract only stable properties for snapshot (exclude walletClient which has dynamic values)
    const { walletClient, ...stableProps } = meeModule
    expect(stableProps).toMatchInlineSnapshot(`
      {
        "address": "0x0000000000000000000000000000000000000000",
        "data": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "deInitData": "0x",
        "erc7739VersionSupported": [Function],
        "getStubSignature": [Function],
        "initData": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "module": "0x0000000000000000000000000000000000000000",
        "signMessage": [Function],
        "signMessageErc7739": [Function],
        "signTypedData": [Function],
        "signTypedDataErc7739": [Function],
        "type": "validator",
      }
    `)
    // Verify walletClient is present and has an account
    expect(walletClient).toBeDefined()
    expect(walletClient?.account?.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
  })

  test("should generate a valid signature", async () => {
    const signature = await meeModule.signMessage("test")
    expect(signature).toMatchInlineSnapshot(
      `"0xf755d9a72d5b7386765e7f0e833af68795b739a267122dae933f41b781b5aed0626ce3263308ebd4c37bed84319b66da2794368771046825bd89b98ba68c4e871b"`
    )
  })
})
