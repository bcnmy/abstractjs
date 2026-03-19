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

import { TOKEN_WITH_PERMIT } from "@biconomy/ecosystem"
import {
  type Address,
  type Hex,
  type PublicClient,
  concat,
  domainSeparator,
  encodeAbiParameters,
  hashMessage,
  keccak256,
  parseAbi,
  parseAbiParameters,
  parseEther,
  toBytes
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../../test/testSetup"
import { getBundlerUrl } from "../../../test/testUtils"
import {
  SIG_TYPE_NO_STX_P256,
  SIG_TYPE_NO_STX_VANILLA_1271_P256,
  eip1271MagicValue
} from "../../account/utils/Constants"
import { toP256Signer } from "../../account/utils/toP256Signer"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../clients/createBicoBundlerClient"
import { MEEVersion } from "../../constants"
import { TokenWithPermitAbi } from "../../constants/abi/TokenWithPermitAbi"
import type { AccountConfig } from "./setupMultiVersion"
import {
  setupAccountsWithSigner,
  setupMultiVersionAccounts
} from "./setupMultiVersion"

const versions = [
  { version: MEEVersion.V2_0_0, label: "V2.0.0" },
  { version: MEEVersion.V2_2_1, label: "V2.2.1" },
  { version: MEEVersion.V3_0_0, label: "V3.0.0" }
]

describe("No-STX Mode Integration Tests", () => {
  const accountConfigMap = new Map<MEEVersion, AccountConfig>()
  let p256AccountConfig: AccountConfig

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")

    // Setup EOA accounts for all versions
    const eoaConfigs = await setupMultiVersionAccounts({
      eoaAccount: network.account!
    })
    for (const config of eoaConfigs) {
      accountConfigMap.set(config.version, config)
    }

    // Setup P256 account for V3.0.0 only (P256 is only supported in V3.0.0+)
    const p256PrivateKey =
      "0x1234567890123456789012345678901234567890123456789012345678901234"
    const p256Signer = toP256Signer(p256PrivateKey)

    const p256Configs = await setupAccountsWithSigner({
      signer: p256Signer,
      eoaAccount: network.account!,
      versions: [MEEVersion.V3_0_0]
    })
    p256AccountConfig = p256Configs[0]
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
      const transferAmount = parseEther("0.00000001")

      const userOp = await nexusClient.prepareUserOperation({
        account: deployment,
        calls: [
          {
            to: recipientAddress,
            value: transferAmount
          }
        ]
      })

      const signature = await deployment.signUserOperation(userOp)
      // good palce for v3.0.0 with p256 signer to attach the prefix
      // const customSig = hexConcat([prefix, signature])

      const userOpHash = await nexusClient.sendUserOperation({
        ...userOp,
        signature: signature
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

    test("should validate .signMessage() result with isValidSignature for all MEE versions", async () => {
      const { mcNexus } = getConfig()

      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient
      const message = "Hello from .signMessage()"

      const signature: Hex = await deployment.signMessage({ message })

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

    test("should validate signTypedData with ERC-7739 flow", async () => {
      const { mcNexus } = getConfig()
      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const chainId = deployment.client.chain!.id
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient

      // Use same Permit structure as toNexusAccount.test.ts
      const appDomain = {
        chainId,
        name: "TokenWithPermit",
        verifyingContract: TOKEN_WITH_PERMIT as Address,
        version: "1"
      }
      const primaryType = "Permit"
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      }

      // Read nonce from TOKEN_WITH_PERMIT contract
      const nonce = (await publicClient.readContract({
        address: TOKEN_WITH_PERMIT as Address,
        abi: TokenWithPermitAbi,
        functionName: "nonces",
        args: [accountAddress]
      })) as bigint

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

      const message = {
        owner: accountAddress,
        spender: accountAddress,
        value: parseEther("2"),
        nonce,
        deadline
      }

      // Sign with deployment.signTypedData
      const signature = await deployment.signTypedData({
        domain: appDomain,
        primaryType,
        types,
        message
      })

      // Manually construct ERC-7739 hash (same as toNexusAccount.test.ts)
      const appDomainSeparator = domainSeparator({ domain: appDomain })
      const permitStructHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters(
            "bytes32, address, address, uint256, uint256, uint256"
          ),
          [
            keccak256(
              toBytes(
                "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
              )
            ),
            accountAddress,
            accountAddress,
            parseEther("2"),
            nonce,
            deadline
          ]
        )
      )
      const contentsHash = keccak256(
        concat(["0x1901", appDomainSeparator, permitStructHash])
      )

      // Verify on-chain with contentsHash (NOT hashTypedData)
      const result = await publicClient.readContract({
        address: accountAddress,
        abi: parseAbi([
          "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
        ]),
        functionName: "isValidSignature",
        args: [contentsHash, signature]
      })

      expect(result).toBe(eip1271MagicValue)
    })
  })

  // P256 Signer Tests (V3.0.0 only)
  describe("V3.0.0 with P256 Signer", () => {
    test.skip("should execute regular userOp with P256 signer", async () => {
      const { mcNexus } = p256AccountConfig

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
      const transferAmount = parseEther("0.0000001")

      const userOp = await nexusClient.prepareUserOperation({
        account: deployment,
        calls: [
          {
            to: recipientAddress,
            value: transferAmount
          }
        ]
      })

      const userOpHash = deployment.getUserOpHash(userOp)
      console.log("userOpHash", userOpHash)

      const rawSignature = await deployment.signUserOperation(userOp)

      // For P256 with V3.0.0, prepend prefix to route to P256StatelessValidator
      // UserOp signatures don't have module address, only: prefix (4 bytes) + P256 sig (64 bytes)
      const prefixedSignature = concat([SIG_TYPE_NO_STX_P256, rawSignature])

      await nexusClient.sendUserOperation({
        ...userOp,
        signature: prefixedSignature
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

    test.skip("should validate EIP-1271 signature with P256 signer", async () => {
      const { mcNexus } = p256AccountConfig
      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient

      const message = "Hello from P256 signer!"
      const signature: Hex = await deployment.signMessage1271({ message })

      // Total signature length: module (20 bytes) + prefix (4 bytes) + P256 sig (64 bytes) = 88 bytes
      // In hex: "0x" + 176 hex chars = 178 chars total
      expect(signature.length).toBe(178)

      // Verify P256 prefix (0x177eee11) - skip module address (20 bytes = 42 chars including "0x")
      expect(`0x${signature.slice(42, 50)}`).toBe(
        SIG_TYPE_NO_STX_VANILLA_1271_P256
      )

      // Verify on-chain
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

    test.skip("should validate signTypedData with P256 signer and ERC-7739 flow", async () => {
      const { mcNexus } = p256AccountConfig
      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const chainId = deployment.client.chain!.id
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient

      // Use same Permit structure as toNexusAccount.test.ts
      const appDomain = {
        chainId,
        name: "TokenWithPermit",
        verifyingContract: TOKEN_WITH_PERMIT as Address,
        version: "1"
      }
      const primaryType = "Permit"
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      }

      const nonce = (await publicClient.readContract({
        address: TOKEN_WITH_PERMIT as Address,
        abi: TokenWithPermitAbi,
        functionName: "nonces",
        args: [accountAddress]
      })) as bigint

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

      const message = {
        owner: accountAddress,
        spender: accountAddress,
        value: parseEther("2"),
        nonce,
        deadline
      }

      const signature = await deployment.signTypedData({
        domain: appDomain,
        primaryType,
        types,
        message
      })

      // no length assertion since as per erc-7739, the signature is appended with plenty of
      // additional data required to rehash the data hash on-chain

      // Verify P256 prefix for signTypedData (uses ERC-7739, so prefix is 0x177eee12)
      // Skip module address (20 bytes = 42 chars including "0x")
      expect(`0x${signature.slice(42, 50)}`).toBe(SIG_TYPE_NO_STX_P256)

      // Manually construct ERC-7739 hash
      const appDomainSeparator = domainSeparator({ domain: appDomain })
      const permitStructHash = keccak256(
        encodeAbiParameters(
          parseAbiParameters(
            "bytes32, address, address, uint256, uint256, uint256"
          ),
          [
            keccak256(
              toBytes(
                "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
              )
            ),
            accountAddress,
            accountAddress,
            parseEther("2"),
            nonce,
            deadline
          ]
        )
      )
      const contentsHash = keccak256(
        concat(["0x1901", appDomainSeparator, permitStructHash])
      )

      // Verify on-chain
      const result = await publicClient.readContract({
        address: accountAddress,
        abi: parseAbi([
          "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
        ]),
        functionName: "isValidSignature",
        args: [contentsHash, signature]
      })

      expect(result).toBe(eip1271MagicValue)
    })

    test.skip("should validate .signMessage() result with P256 signer", async () => {
      const { mcNexus } = p256AccountConfig
      const deployment = mcNexus.deploymentOn(
        mcNexus.deployments[0].client.chain!.id,
        true
      )
      const accountAddress = await deployment.getAddress()
      const publicClient = deployment.client as PublicClient
      const message = "Hello from P256 .signMessage()"

      const signature: Hex = await deployment.signMessage({ message })

      // Total signature length: module (20 bytes) + prefix (4 bytes) + P256 sig (64 bytes) = 88 bytes
      // In hex: "0x" + 176 hex chars = 178 chars total
      expect(signature.length).toBe(178)

      // Verify P256 ERC-7739 prefix (0x177eee12)
      // Skip module address (20 bytes = 42 chars including "0x")
      expect(`0x${signature.slice(42, 50)}`).toBe(SIG_TYPE_NO_STX_P256)

      // Verify on-chain
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
})
