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
import { type NetworkConfig, getBundlerUrl } from "../../../test/testUtils"
import { eip1271MagicValue } from "../../account/utils/Constants"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../clients/createBicoBundlerClient"
import type { AccountConfig } from "./setupMultiVersion"
import { setupMultiVersionAccounts } from "./setupMultiVersion"
import { MEEVersion } from "../../constants"

describe("No-STX Mode Integration Tests", () => {
  let accountConfigs: AccountConfig[] = []
  let network: NetworkConfig

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    const eoaAccount = network.account!

    // Create accounts for all 3 versions
    accountConfigs = await setupMultiVersionAccounts({
      eoaAccount
    })
  })

  test("should execute regular userOp without supertxn envelope for all versions", async () => {
    for (const { name, mcNexus } of accountConfigs) {
      console.log(`Testing ${name}`)

      // Get deployment for first chain
      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )

      // Create bundler client for regular userOp execution.
      // Use bundler URL for the deployment's chain (not network.chain), since we use
      // the first deployment which may not match TESTNET_CHAIN_ID.
      const chainId = deployment.client.chain!.id
      const nexusClient: NexusClient = createSmartAccountClient({
        account: deployment,
        bundlerUrl: getBundlerUrl(chainId)
      })

      // Prepare a simple ETH transfer
      const recipientAddress = "0x1234567890123456789012345678901234567890"
      const transferAmount = parseEther("0.001")

      // Execute userOp (no supertxn envelope).
      // Pass account explicitly so viem uses this account's signUserOperation (real signature, not stub).
      const userOpHash = await nexusClient.sendUserOperation({
        account: deployment,
        calls: [
          {
            to: recipientAddress,
            value: transferAmount
          }
        ]
      })

      // Wait for userOp receipt
      const userOpReceipt = await nexusClient.waitForUserOperationReceipt({
        hash: userOpHash
      })

      const txHash = userOpReceipt.receipt.transactionHash

      // Verify transaction was executed
      expect(txHash).toBeDefined()
      expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)

      // Wait for receipt
      const receipt = await nexusClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt.status).toBe("success")
    }
  })

  test("should validate EIP-1271 signature for all versions", async () => {
    for (const { name, mcNexus } of accountConfigs) {
      console.log(`Testing ${name}`)

      // Get deployment for first chain
      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient

      // Message to sign
      const message = "Hello from no-stx mode!"

      // Sign message with account signer
      const signature: Hex = await deployment.signMessage1271({ message })

      // Call isValidSignature on the contract
      const result = await publicClient.readContract({
        address: accountAddress,
        abi: parseAbi([
          "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
        ]),
        functionName: "isValidSignature",
        args: [hashMessage(message), signature]
      })
      
      // Verify EIP-1271 magic value
      expect(result).toBe(eip1271MagicValue)
    }
  })

  test("should validate ERC-7739 signature by default for v3.0.0", async () => {
    // get the account config for v3.0.0
    const accountConfig = accountConfigs.find(config => config.version === MEEVersion.V3_0_0)
    if (!accountConfig) {
      throw new Error("Account config for v3.0.0 not found")
    }

    // get the deployment for v3.0.0
    const deployment = accountConfig.mcNexus.deploymentOn(
      accountConfig.mcNexus.deployments[0].client.chain!.id,
      true
    )

    const publicClient = deployment.client as PublicClient
    const message = "Hello from v3.0.0"

    // now use Nexus' signMessage to sign a message
    const signature: Hex = await deployment.signMessage({ message })

    // call isValidSignature on the contract
    const result = await publicClient.readContract({
      address: deployment.address,
      abi: parseAbi([
        "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
      ]),
      functionName: "isValidSignature",
      args: [hashMessage(message), signature]
    })  

    // verify the signature
    expect(result).toBe(eip1271MagicValue)
  })
})
