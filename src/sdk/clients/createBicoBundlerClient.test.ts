import { http, type Account, type Address, type Chain } from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { testnetTest, toNetwork } from "../../test/testSetup"
import {
  getTestAccount,
  killNetwork,
  toTestClient,
  topUp
} from "../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../account/toNexusAccount"
import {
  type BicoBundlerClient,
  createBicoBundlerClient,
  createSmartAccountClient
} from "./createBicoBundlerClient"

describe("bico.bundler", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: Account
  let nexusAccountAddress: Address
  let bicoBundler: BicoBundlerClient
  let nexusAccount: NexusAccount

  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    testClient = toTestClient(chain, getTestAccount(5))

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    bicoBundler = createBicoBundlerClient({
      mock: true,
      bundlerUrl,
      account: nexusAccount
    })
    nexusAccountAddress = await nexusAccount.getAddress()
    await topUp(testClient, nexusAccountAddress)
  })

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  testnetTest(
    "should demo adjusting gas estimates returned by bico bundler",
    async ({ config: { account, chain, bundlerUrl, rpcUrl } }) => {
      if (!account) {
        throw new Error("Account is required")
      }
      const nexusAccount = await toNexusAccount({
        chain,
        signer: account,
        transport: http(rpcUrl)
      })

      const nexusClient = createSmartAccountClient({
        account: nexusAccount,
        transport: http(bundlerUrl)
      })

      const [
        preparedUserOperationWithoutGasBuffer,
        preparedUserOperationWithGasBuffer
      ] = await Promise.all([
        nexusClient.prepareUserOperation({
          calls: [
            {
              to: account.address,
              value: 1n
            }
          ]
        }),
        nexusClient.prepareUserOperation({
          gasBuffer: {
            factor: 1.2,
            fields: ["preVerificationGas", "verificationGasLimit"]
          },
          calls: [
            {
              to: account.address,
              value: 1n
            }
          ]
        })
      ])

      expect(
        preparedUserOperationWithGasBuffer.preVerificationGas
      ).toBeGreaterThan(
        preparedUserOperationWithoutGasBuffer.preVerificationGas
      )
      expect(
        preparedUserOperationWithGasBuffer.verificationGasLimit
      ).toBeGreaterThan(
        preparedUserOperationWithoutGasBuffer.verificationGasLimit
      )
      expect(preparedUserOperationWithGasBuffer.callGasLimit).toEqual(
        preparedUserOperationWithoutGasBuffer.callGasLimit
      )
    }
  )

  test.concurrent(
    "should have been extended by biconomy specific actions",
    async () => {
      const gasFees = await bicoBundler.getGasFeeValues()
      expect(gasFees).toHaveProperty("fast")
      expect(gasFees).toHaveProperty("standard")
      expect(gasFees).toHaveProperty("slow")
      expect(gasFees.fast.maxFeePerGas).toBeGreaterThan(0n)
    }
  )

  test("should send a user operation and get the receipt", async () => {
    const calls = [{ to: eoaAccount.address, value: 1n }]
    // Must find gas fees before sending the user operation
    const gas = await testClient.estimateFeesPerGas()
    const hash = await bicoBundler.sendUserOperation({
      ...gas,
      calls,
      account: nexusAccount
    })
    const receipt = await bicoBundler.waitForUserOperationReceipt({ hash })
    expect(receipt.success).toBeTruthy()
  })
})
