/**
 * No-STX Mode Integration Tests
 *
 * Tests regular userOps without supertransaction envelope across MEE versions.
 * No-STX mode characteristics:
 * - Direct userOp execution or EIP-1271 validation
 *
 * Tested versions: V2.0.0, V2.2.1, V3.0.0
 * Testnets: Base Sepolia, Optimism Sepolia
 */

import {
  type Hex,
  type PublicClient,
  hashMessage,
  parseAbi,
  parseEther
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../../test/testSetup"
import { getBundlerUrl } from "../../../test/testUtils"
import { eip1271MagicValue } from "../../account/utils/Constants"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../clients/createBicoBundlerClient"
import { MEEVersion } from "../../constants"
import type { AccountConfig } from "./setupMultiVersion"
import { setupMultiVersionAccounts } from "./setupMultiVersion"

const versions = [
  { version: MEEVersion.V2_0_0, label: "V2.0.0" },
  { version: MEEVersion.V2_2_1, label: "V2.2.1" },
  { version: MEEVersion.V3_0_0, label: "V3.0.0" }
]

describe("No-STX Mode Integration Tests", () => {
  const accountConfigMap = new Map<MEEVersion, AccountConfig>()

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    const configs = await setupMultiVersionAccounts({
      eoaAccount: network.account!
    })
    for (const config of configs) {
      accountConfigMap.set(config.version, config)
    }
  })

  describe.each(versions)("$label", ({ version }) => {
    const getConfig = () => accountConfigMap.get(version)!

    test("should execute regular userOp without supertxn envelope", async () => {
      const { mcNexus } = getConfig()

      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )

      const chainId = deployment.client.chain!.id
      const nexusClient: NexusClient = createSmartAccountClient({
        account: deployment,
        bundlerUrl: getBundlerUrl(chainId)
      })

      const recipientAddress = "0x1234567890123456789012345678901234567890"
      const transferAmount = parseEther("0.001")

      const userOpHash = await nexusClient.sendUserOperation({
        account: deployment,
        calls: [
          {
            to: recipientAddress,
            value: transferAmount
          }
        ]
      })

      const userOpReceipt = await nexusClient.waitForUserOperationReceipt({
        hash: userOpHash
      })

      const txHash = userOpReceipt.receipt.transactionHash

      expect(txHash).toBeDefined()
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

      const receipt = await nexusClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt.status).toBe("success")
    })

    test("should validate EIP-1271 signature", async () => {
      const { mcNexus } = getConfig()

      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient

      const message = "Hello from no-stx mode!"

      const signature: Hex = await deployment.signMessage1271({ message })

      const result = await publicClient.readContract({
        address: accountAddress,
        abi: parseAbi([
          "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
        ]),
        functionName: "isValidSignature",
        args: [hashMessage(message), signature]
      })

      expect(result).toBe(eip1271MagicValue)
    })
  })

  test("should validate ERC-7739 signature by default for v3.0.0", async () => {
    const accountConfig = accountConfigMap.get(MEEVersion.V3_0_0)
    if (!accountConfig) {
      throw new Error("Account config for v3.0.0 not found")
    }

    const deployment = accountConfig.mcNexus.deploymentOn(
      accountConfig.mcNexus.deployments[0].client.chain!.id,
      true
    )

    const publicClient = deployment.client as PublicClient
    const message = "Hello from v3.0.0"

    const signature: Hex = await deployment.signMessage({ message })

    const result = await publicClient.readContract({
      address: deployment.address,
      abi: parseAbi([
        "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
      ]),
      functionName: "isValidSignature",
      args: [hashMessage(message), signature]
    })

    expect(result).toBe(eip1271MagicValue)
  })
})
