import {
  http,
  type Address,
  type Hex,
  type PublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  parseAbi,
  parseUnits
} from "viem"
import { generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  toNetwork
} from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import type { NetworkConfig } from "../../../test/testUtils"
import type { MeeClient } from "../../clients/createMeeClient"
import type { GetQuoteParams } from "../../clients/decorators/mee/getQuote"
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import { MEEVersion } from "../../constants"
import type { AccountConfig } from "../../integration-tests/mee-versions/setupMultiVersion"
import { setupMultiVersionAccounts } from "../../integration-tests/mee-versions/setupMultiVersion"
import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"
import { toP256Signer } from "../utils/toP256Signer"
import {
  deriveOwnershipData,
  filterDeployments,
  resolveStatelessValidator
} from "./ownership"

const FEE_TOKEN_ADDRESS = testnetMcTestUSDCP.addressOn(baseSepolia.id)
const MIN_FEE_TOKEN_BALANCE = parseUnits("0.3", 6)
const FEE_TOKEN_FUNDING_AMOUNT = parseUnits("1", 6)

const FEE_TOKEN = {
  address: FEE_TOKEN_ADDRESS,
  chainId: baseSepolia.id
}

function quoteParams(instructions: Instruction[]): GetQuoteParams {
  return { instructions, feeToken: FEE_TOKEN }
}

async function fundFeeTokenIfNeeded(configs: AccountConfig[]) {
  for (const { mcNexus, eoaAccount } of configs) {
    const deployment = mcNexus.deploymentOn(baseSepolia.id, true)
    const publicClient = deployment.client as PublicClient

    const balance = await publicClient.readContract({
      address: FEE_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [deployment.address]
    })

    if (balance < MIN_FEE_TOKEN_BALANCE) {
      const walletClient = createWalletClient({
        account: eoaAccount,
        chain: baseSepolia,
        transport: http(TESTNET_RPC_URLS[baseSepolia.id])
      })
      const hash = await walletClient.writeContract({
        address: FEE_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [deployment.address, FEE_TOKEN_FUNDING_AMOUNT]
      })
      await publicClient.waitForTransactionReceipt({ hash })
    }
  }
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const CUSTOM_VALIDATOR_ADDRESS =
  "0x1234567890abcdef1234567890abcdef12345678" as Address

const stxValidatorAbi = parseAbi([
  "function setOwnershipData(address statelessValidatorAddress, bytes ownershipData)",
  "function cleanOwnershipData(address statelessValidatorAddress)",
  "function getOwnershipData(address smartAccount, address statelessValidatorAddress) view returns (bytes)"
])

// ---------------------------------------------------------------------------
// UNIT TESTS
// ---------------------------------------------------------------------------

describe("ownership - unit tests", () => {
  let mcNexus: MultichainSmartAccount

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    const configs = await setupMultiVersionAccounts({
      eoaAccount: network.account!,
      versions: [MEEVersion.V3_0_0],
      index: 55n
    })
    mcNexus = configs[0].mcNexus
  })

  // -------------------------------------------------------------------------
  // resolveStatelessValidator
  // -------------------------------------------------------------------------
  describe("resolveStatelessValidator", () => {
    test("should resolve 'eoa' to EoaStatelessValidator address", () => {
      const submodules = mcNexus.deployments[0].version.submodules
      const result = resolveStatelessValidator("eoa", submodules)
      expect(result).toBe(submodules?.EoaStatelessValidator)
    })

    test("should resolve 'p256' to P256StatelessValidator address", () => {
      const submodules = mcNexus.deployments[0].version.submodules
      const result = resolveStatelessValidator("p256", submodules)
      expect(result).toBe(submodules?.P256StatelessValidator)
    })

    test("should resolve 'safe' to SafeAccountSubmodule address", () => {
      const submodules = mcNexus.deployments[0].version.submodules
      const result = resolveStatelessValidator("safe", submodules)
      expect(result).toBe(submodules?.SafeAccountSubmodule)
    })

    test("should pass through a raw address as-is with submodules", () => {
      const submodules = mcNexus.deployments[0].version.submodules
      const result = resolveStatelessValidator(
        CUSTOM_VALIDATOR_ADDRESS,
        submodules
      )
      expect(result).toBe(CUSTOM_VALIDATOR_ADDRESS)
    })

    test("should pass through a custom address even without submodules", () => {
      const result = resolveStatelessValidator(CUSTOM_VALIDATOR_ADDRESS)
      expect(result).toBe(CUSTOM_VALIDATOR_ADDRESS)
    })

    test("should throw when submodule address is undefined", () => {
      expect(() => resolveStatelessValidator("eoa", {})).toThrow(
        'Stateless validator address for "eoa" not found in submodules'
      )
    })

    test("should throw when submodules is undefined", () => {
      expect(() => resolveStatelessValidator("p256", undefined)).toThrow(
        'Stateless validator address for "p256" not found in submodules'
      )
    })
  })

  // -------------------------------------------------------------------------
  // deriveOwnershipData
  // -------------------------------------------------------------------------
  describe("deriveOwnershipData", () => {
    test("should derive EOA ownership data from signer address", () => {
      const result = deriveOwnershipData(mcNexus.signer, "eoa")
      const expected = encodePacked(["address"], [mcNexus.signer.address])
      expect(result).toBe(expected)
    })

    test("should derive safe ownership data from signer address (same as EOA)", () => {
      const result = deriveOwnershipData(mcNexus.signer, "safe")
      const expected = encodePacked(["address"], [mcNexus.signer.address])
      expect(result).toBe(expected)
    })

    test("should derive P256 ownership data from signer publicKey", () => {
      const p256Signer = toP256Signer(generatePrivateKey())
      const result = deriveOwnershipData(p256Signer, "p256")
      const x = `0x${p256Signer.publicKey.slice(4, 68)}` as Hex
      const y = `0x${p256Signer.publicKey.slice(68, 132)}` as Hex
      const expected = encodePacked(["bytes32", "bytes32"], [x, y])
      expect(result).toBe(expected)
    })

    test("should use override when provided regardless of type", () => {
      const override = "0xdeadbeef" as Hex
      const result = deriveOwnershipData(mcNexus.signer, "eoa", override)
      expect(result).toBe(override)
    })

    test("should use override for custom validator type", () => {
      const override = "0xcafebabe" as Hex
      const result = deriveOwnershipData(
        mcNexus.signer,
        CUSTOM_VALIDATOR_ADDRESS,
        override
      )
      expect(result).toBe(override)
    })

    test("should throw for custom validator address without ownershipData", () => {
      expect(() =>
        deriveOwnershipData(mcNexus.signer, CUSTOM_VALIDATOR_ADDRESS)
      ).toThrow(
        "ownershipData must be provided when using a custom stateless validator address"
      )
    })

    test("should throw for P256 signer without publicKey", () => {
      const signerWithoutPubKey = {
        ...mcNexus.signer,
        publicKey: undefined
      } as any
      expect(() => deriveOwnershipData(signerWithoutPubKey, "p256")).toThrow(
        "P256 signer must have a publicKey to derive ownership data"
      )
    })
  })

  // -------------------------------------------------------------------------
  // filterDeployments
  // -------------------------------------------------------------------------
  describe("filterDeployments", () => {
    test("should return all deployments when chainIds is undefined", () => {
      const result = filterDeployments(mcNexus.deployments)
      expect(result).toHaveLength(mcNexus.deployments.length)
    })

    test("should return all deployments when chainIds is empty", () => {
      const result = filterDeployments(mcNexus.deployments, [])
      expect(result).toHaveLength(mcNexus.deployments.length)
    })

    test("should filter to requested chainIds", () => {
      const firstChainId = mcNexus.deployments[0].client.chain!.id
      const result = filterDeployments(mcNexus.deployments, [firstChainId])
      expect(result).toHaveLength(1)
      expect(result[0].client.chain?.id).toBe(firstChainId)
    })

    test("should throw when a requested chainId is not in deployments", () => {
      expect(() => filterDeployments(mcNexus.deployments, [99999])).toThrow(
        "No deployments found for chainIds: 99999"
      )
    })

    test("should include available chainIds in error message", () => {
      expect(() => filterDeployments(mcNexus.deployments, [99999])).toThrow(
        "Available chainIds:"
      )
    })
  })

  // -------------------------------------------------------------------------
  // addOwnership
  // -------------------------------------------------------------------------
  describe("addOwnership", () => {
    test("should return one instruction per deployment", () => {
      const instructions = mcNexus.addOwnership({
        coreOwnershipParams: { ownershipType: "eoa" }
      })
      expect(instructions).toHaveLength(mcNexus.deployments.length)
      expect(instructions[0].chainId).toBe(
        mcNexus.deployments[0].client.chain!.id
      )
      expect(instructions[1].chainId).toBe(
        mcNexus.deployments[1].client.chain!.id
      )
    })

    test("should target validatorAddress in each instruction", () => {
      const instructions = mcNexus.addOwnership({
        coreOwnershipParams: { ownershipType: "eoa" }
      })
      for (let i = 0; i < instructions.length; i++) {
        expect(instructions[i].calls).toHaveLength(1)
        expect(instructions[i].calls[0].to).toBe(
          mcNexus.deployments[i].version.validatorAddress
        )
      }
    })

    test("should encode setOwnershipData calldata correctly", () => {
      const instructions = mcNexus.addOwnership({
        coreOwnershipParams: { ownershipType: "eoa" }
      })

      const submodules = mcNexus.deployments[0].version.submodules
      const expectedOwnershipData = encodePacked(
        ["address"],
        [mcNexus.signer.address]
      )
      const expectedCalldata = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "setOwnershipData",
        args: [submodules?.EoaStatelessValidator!, expectedOwnershipData]
      })

      expect((instructions[0].calls[0] as { data: Hex }).data).toBe(
        expectedCalldata
      )
    })

    test("should respect chainIds filter", () => {
      const firstChainId = mcNexus.deployments[0].client.chain!.id
      const instructions = mcNexus.addOwnership({
        coreOwnershipParams: {
          ownershipType: "eoa",
          chainIds: [firstChainId]
        }
      })
      expect(instructions).toHaveLength(1)
      expect(instructions[0].chainId).toBe(firstChainId)
    })

    test("should use ownershipData override when provided", () => {
      const customData = "0xdeadbeefcafebabe" as Hex
      const instructions = mcNexus.addOwnership({
        coreOwnershipParams: { ownershipType: "eoa" },
        ownershipData: customData
      })

      const submodules = mcNexus.deployments[0].version.submodules
      const expectedCalldata = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "setOwnershipData",
        args: [submodules?.EoaStatelessValidator!, customData]
      })

      expect((instructions[0].calls[0] as { data: Hex }).data).toBe(
        expectedCalldata
      )
    })
  })

  // -------------------------------------------------------------------------
  // cleanOwnership
  // -------------------------------------------------------------------------
  describe("cleanOwnership", () => {
    test("should return one instruction per deployment", () => {
      const instructions = mcNexus.cleanOwnership({
        ownershipType: "eoa"
      })
      expect(instructions).toHaveLength(mcNexus.deployments.length)
    })

    test("should encode cleanOwnershipData calldata correctly", () => {
      const instructions = mcNexus.cleanOwnership({
        ownershipType: "eoa"
      })

      const submodules = mcNexus.deployments[0].version.submodules
      const expectedCalldata = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "cleanOwnershipData",
        args: [submodules?.EoaStatelessValidator!]
      })

      expect((instructions[0].calls[0] as { data: Hex }).data).toBe(
        expectedCalldata
      )
    })

    test("should respect chainIds filter", () => {
      const firstChainId = mcNexus.deployments[0].client.chain!.id
      const instructions = mcNexus.cleanOwnership({
        ownershipType: "eoa",
        chainIds: [firstChainId]
      })
      expect(instructions).toHaveLength(1)
      expect(instructions[0].chainId).toBe(firstChainId)
    })
  })
})

// ---------------------------------------------------------------------------
// INTEGRATION TESTS
// ---------------------------------------------------------------------------
// Uses an EOA-signed account but manages p256 ownership data.
// This avoids touching the EOA ownership that the MEE node relies on
// for signature verification, while fully testing the ownership lifecycle.

describe("ownership - integration tests", () => {
  let network: NetworkConfig
  let accountConfig: AccountConfig
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  // Create P256 signers to derive ownership data from
  const p256Signer = toP256Signer(
    "0xaa11111111111111111111111111111111111111111111111111111111111111"
  )
  const p256OwnershipData = deriveOwnershipData(p256Signer, "p256")

  const changedP256Signer = toP256Signer(
    "0xbb22222222222222222222222222222222222222222222222222222222222222"
  )
  const changedP256OwnershipData = deriveOwnershipData(
    changedP256Signer,
    "p256"
  )

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    const configs = await setupMultiVersionAccounts({
      eoaAccount: network.account!,
      versions: [MEEVersion.V3_0_0],
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
      index: 55n
    })

    await fundFeeTokenIfNeeded(configs)

    accountConfig = configs[0]
    mcNexus = accountConfig.mcNexus
    meeClient = accountConfig.meeClient
  })

  test("addOwnership(p256) → getOwnership → verify against direct readContract", async () => {
    const instructions = mcNexus.addOwnership({
      coreOwnershipParams: { ownershipType: "p256" },
      ownershipData: p256OwnershipData
    })

    expect(instructions.length).toBeGreaterThan(0)

    const quote = await meeClient.getQuote(quoteParams(instructions))
    const { hash } = await meeClient.executeQuote({ quote })
    await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    const ownershipResults = await mcNexus.getOwnership({
      ownershipType: "p256"
    })

    expect(ownershipResults.length).toBeGreaterThan(0)

    for (const result of ownershipResults) {
      expect(result.data).toBe(p256OwnershipData)

      // Also verify with direct readContract
      const deployment = mcNexus.deploymentOn(result.chainId, true)
      const publicClient = deployment.client as PublicClient
      const statelessValidator =
        deployment.version.submodules?.P256StatelessValidator

      const directResult = await publicClient.readContract({
        address: deployment.version.validatorAddress,
        abi: stxValidatorAbi,
        functionName: "getOwnershipData",
        args: [deployment.address, statelessValidator!]
      })

      expect(result.data).toBe(directResult)
    }
  })

  test("changeOwnership(p256) should succeed when ownership exists", async () => {
    // p256 ownership was set by the previous test
    const instructions = await mcNexus.changeOwnership({
      coreOwnershipParams: { ownershipType: "p256" },
      ownershipData: changedP256OwnershipData
    })

    expect(instructions.length).toBeGreaterThan(0)

    const quote = await meeClient.getQuote(quoteParams(instructions))
    const { hash } = await meeClient.executeQuote({ quote })
    await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    const ownershipResults = await mcNexus.getOwnership({
      ownershipType: "p256"
    })

    for (const result of ownershipResults) {
      expect(result.data).toBe(changedP256OwnershipData)
    }
  })

  test("changeOwnership should throw when no ownership data exists", async () => {
    // "safe" ownership type has no data set on-chain
    await expect(
      mcNexus.changeOwnership({
        coreOwnershipParams: { ownershipType: "safe" }
      })
    ).rejects.toThrow("No ownership data found")
  })

  test("cleanOwnership(p256) → getOwnership returns empty", async () => {
    // p256 ownership exists from previous tests
    const cleanInstructions = mcNexus.cleanOwnership({
      ownershipType: "p256"
    })

    expect(cleanInstructions.length).toBeGreaterThan(0)

    const quote = await meeClient.getQuote(quoteParams(cleanInstructions))
    const { hash } = await meeClient.executeQuote({ quote })
    await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    const ownershipResults = await mcNexus.getOwnership({
      ownershipType: "p256"
    })

    for (const result of ownershipResults) {
      expect(
        result.data === "0x" || result.data === "0x0" || result.data.length <= 4
      ).toBe(true)
    }
  })

  test("getOwnership with chainIds filter should only return for specified chains", async () => {
    const firstChainId = mcNexus.deployments[0].client.chain!.id

    const results = await mcNexus.getOwnership({
      ownershipType: "p256",
      chainIds: [firstChainId]
    })

    expect(results).toHaveLength(1)
    expect(results[0].chainId).toBe(firstChainId)
  })
})
