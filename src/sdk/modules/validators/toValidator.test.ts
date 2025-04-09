import type { Chain, LocalAccount } from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import {
  type MasterClient,
  type NetworkConfig,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../../test/testUtils"
import { toValidator } from "./toValidator"

describe("modules.toValidator", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount

  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    testClient = toTestClient(chain, getTestAccount(5))
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test.concurrent("should create a generic module", async () => {
    const validatorModule = toValidator({
      address: "0x0000000000000000000000000000000000000000",
      initData: "0x",
      deInitData: "0x",
      signer: eoaAccount,
      module: "0x0000000000000000000000000000000000000000"
    })

    expect(validatorModule).toMatchInlineSnapshot(`
      {
        "address": "0x0000000000000000000000000000000000000000",
        "data": "0x",
        "deInitData": "0x",
        "getStubSignature": [Function],
        "initData": "0x",
        "module": "0x0000000000000000000000000000000000000000",
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
})
