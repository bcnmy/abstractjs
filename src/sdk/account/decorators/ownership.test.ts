import {
  type Address,
  type Hex,
  type PublicClient,
  createWalletClient,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  http,
  parseAbi,
  parseUnits
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
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
import type { MEEVersionConfig } from "../utils/getVersion"
import type { ModularSmartAccount } from "../../modules/utils/Types"
import type { BaseMultichainSmartAccount } from "../toMultiChainNexusAccount"
import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"
import { toP256Signer } from "../utils/toP256Signer"
import type { AccountConfig } from "../../integration-tests/mee-versions/setupMultiVersion"
import { setupMultiVersionAccounts } from "../../integration-tests/mee-versions/setupMultiVersion"
import {
  addOwnership,
  changeOwnership,
  cleanOwnership,
  deriveOwnershipData,
  filterDeployments,
  getOwnership,
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

const MOCK_EOA_ADDRESS = "0xdD900Cd95f072eAe396bE0487C2546Bf81d01B48" as Address
const MOCK_P256_ADDRESS = "0xa7B97e8152aCee107a098F95f691Cd24Cf2f9835" as Address
const MOCK_SAFE_ADDRESS = "0xa35a716E8e1Df5Fb441bCDdC2357cf9b256AC566" as Address
const MOCK_VALIDATOR_ADDRESS = "0x8b0Aa5d4c0e06a463bd67CBaF7D00C21c861Ce58" as Address
const MOCK_CUSTOM_VALIDATOR = "0x1234567890abcdef1234567890abcdef12345678" as Address

const MOCK_SUBMODULES: MEEVersionConfig["submodules"] = {
  EoaStatelessValidator: MOCK_EOA_ADDRESS,
  P256StatelessValidator: MOCK_P256_ADDRESS,
  SafeAccountSubmodule: MOCK_SAFE_ADDRESS
}

const stxValidatorAbi = parseAbi([
  "function setOwnershipData(address statelessValidatorAddress, bytes ownershipData)",
  "function cleanOwnershipData(address statelessValidatorAddress)",
  "function getOwnershipData(address smartAccount, address statelessValidatorAddress) view returns (bytes)"
])

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockDeployment(
  chainId: number,
  submodules: MEEVersionConfig["submodules"] = MOCK_SUBMODULES,
  validatorAddress: Address = MOCK_VALIDATOR_ADDRESS,
  accountAddress: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address
): ModularSmartAccount {
  return {
    client: { chain: { id: chainId } },
    version: { submodules, validatorAddress },
    address: accountAddress
  } as unknown as ModularSmartAccount
}

function createMockAccount(
  deployments: ModularSmartAccount[],
  signerAddress: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Address,
  publicKey?: Hex
): BaseMultichainSmartAccount {
  return {
    deployments,
    signer: {
      address: signerAddress,
      ...(publicKey ? { publicKey, source: "p256" } : {})
    },
    deploymentOn: (chainId: number, strictMode?: boolean) => {
      const dep = deployments.find((d) => (d.client.chain as any)?.id === chainId)
      if (!dep && strictMode) throw new Error(`Deployment not found for chainId: ${chainId}`)
      return dep
    },
    addressOn: (chainId: number, strictMode?: boolean) => {
      const dep = deployments.find((d) => (d.client.chain as any)?.id === chainId)
      if (!dep && strictMode) throw new Error(`Deployment not found for chainId: ${chainId}`)
      return dep?.address
    }
  } as unknown as BaseMultichainSmartAccount
}

// ---------------------------------------------------------------------------
// UNIT TESTS
// ---------------------------------------------------------------------------

describe("ownership - unit tests", () => {
  // -------------------------------------------------------------------------
  // resolveStatelessValidator
  // -------------------------------------------------------------------------
  describe("resolveStatelessValidator", () => {
    test("should resolve 'eoa' to EoaStatelessValidator address", () => {
      const result = resolveStatelessValidator("eoa", MOCK_SUBMODULES)
      expect(result).toBe(MOCK_EOA_ADDRESS)
    })

    test("should resolve 'p256' to P256StatelessValidator address", () => {
      const result = resolveStatelessValidator("p256", MOCK_SUBMODULES)
      expect(result).toBe(MOCK_P256_ADDRESS)
    })

    test("should resolve 'safe' to SafeAccountSubmodule address", () => {
      const result = resolveStatelessValidator("safe", MOCK_SUBMODULES)
      expect(result).toBe(MOCK_SAFE_ADDRESS)
    })

    test("should pass through a raw address as-is", () => {
      const result = resolveStatelessValidator(MOCK_CUSTOM_VALIDATOR, MOCK_SUBMODULES)
      expect(result).toBe(MOCK_CUSTOM_VALIDATOR)
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
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    test("should derive EOA ownership data from signer address", () => {
      const result = deriveOwnershipData(eoaAccount, "eoa")
      const expected = encodePacked(["address"], [eoaAccount.address])
      expect(result).toBe(expected)
    })

    test("should derive safe ownership data from signer address (same as EOA)", () => {
      const result = deriveOwnershipData(eoaAccount, "safe")
      const expected = encodePacked(["address"], [eoaAccount.address])
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
      const result = deriveOwnershipData(eoaAccount, "eoa", override)
      expect(result).toBe(override)
    })

    test("should use override for custom validator type", () => {
      const override = "0xcafebabe" as Hex
      const result = deriveOwnershipData(eoaAccount, MOCK_CUSTOM_VALIDATOR, override)
      expect(result).toBe(override)
    })

    test("should throw for custom validator address without ownershipData", () => {
      expect(() => deriveOwnershipData(eoaAccount, MOCK_CUSTOM_VALIDATOR)).toThrow(
        "ownershipData must be provided when using a custom stateless validator address"
      )
    })

    test("should throw for P256 signer without publicKey", () => {
      const signerWithoutPubKey = { ...eoaAccount, publicKey: undefined } as any
      expect(() => deriveOwnershipData(signerWithoutPubKey, "p256")).toThrow(
        "P256 signer must have a publicKey to derive ownership data"
      )
    })
  })

  // -------------------------------------------------------------------------
  // filterDeployments
  // -------------------------------------------------------------------------
  describe("filterDeployments", () => {
    const deployments = [
      createMockDeployment(10),
      createMockDeployment(8453),
      createMockDeployment(42161)
    ]

    test("should return all deployments when chainIds is undefined", () => {
      const result = filterDeployments(deployments)
      expect(result).toHaveLength(3)
    })

    test("should return all deployments when chainIds is empty", () => {
      const result = filterDeployments(deployments, [])
      expect(result).toHaveLength(3)
    })

    test("should filter to requested chainIds", () => {
      const result = filterDeployments(deployments, [10, 42161])
      expect(result).toHaveLength(2)
      expect(result[0].client.chain?.id).toBe(10)
      expect(result[1].client.chain?.id).toBe(42161)
    })

    test("should throw when a requested chainId is not in deployments", () => {
      expect(() => filterDeployments(deployments, [10, 99999])).toThrow(
        "No deployments found for chainIds: 99999"
      )
    })

    test("should include available chainIds in error message", () => {
      expect(() => filterDeployments(deployments, [99999])).toThrow(
        "Available chainIds:"
      )
    })
  })

  // -------------------------------------------------------------------------
  // addOwnership
  // -------------------------------------------------------------------------
  describe("addOwnership", () => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())
    const deployments = [
      createMockDeployment(10),
      createMockDeployment(8453)
    ]
    const mockAccount = createMockAccount(deployments, eoaAccount.address)

    test("should return one instruction per deployment", () => {
      const instructions = addOwnership(mockAccount, {
        coreOwnershipParams: { ownershipType: "eoa" }
      })
      expect(instructions).toHaveLength(2)
      expect(instructions[0].chainId).toBe(10)
      expect(instructions[1].chainId).toBe(8453)
    })

    test("should target validatorAddress in each instruction", () => {
      const instructions = addOwnership(mockAccount, {
        coreOwnershipParams: { ownershipType: "eoa" }
      })
      for (const ix of instructions) {
        expect(ix.calls).toHaveLength(1)
        expect(ix.calls[0].to).toBe(MOCK_VALIDATOR_ADDRESS)
      }
    })

    test("should encode setOwnershipData calldata correctly", () => {
      const instructions = addOwnership(mockAccount, {
        coreOwnershipParams: { ownershipType: "eoa" }
      })

      const expectedOwnershipData = encodePacked(["address"], [eoaAccount.address])
      const expectedCalldata = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "setOwnershipData",
        args: [MOCK_EOA_ADDRESS, expectedOwnershipData]
      })

      expect((instructions[0].calls[0] as { data: Hex }).data).toBe(expectedCalldata)
    })

    test("should respect chainIds filter", () => {
      const instructions = addOwnership(mockAccount, {
        coreOwnershipParams: { ownershipType: "eoa", chainIds: [8453] }
      })
      expect(instructions).toHaveLength(1)
      expect(instructions[0].chainId).toBe(8453)
    })

    test("should use ownershipData override when provided", () => {
      const customData = "0xdeadbeefcafebabe" as Hex
      const instructions = addOwnership(mockAccount, {
        coreOwnershipParams: { ownershipType: "eoa" },
        ownershipData: customData
      })

      const expectedCalldata = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "setOwnershipData",
        args: [MOCK_EOA_ADDRESS, customData]
      })

      expect((instructions[0].calls[0] as { data: Hex }).data).toBe(expectedCalldata)
    })
  })

  // -------------------------------------------------------------------------
  // cleanOwnership
  // -------------------------------------------------------------------------
  describe("cleanOwnership", () => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())
    const deployments = [
      createMockDeployment(10),
      createMockDeployment(8453)
    ]
    const mockAccount = createMockAccount(deployments, eoaAccount.address)

    test("should return one instruction per deployment", () => {
      const instructions = cleanOwnership(mockAccount, {
        ownershipType: "eoa"
      })
      expect(instructions).toHaveLength(2)
    })

    test("should encode cleanOwnershipData calldata correctly", () => {
      const instructions = cleanOwnership(mockAccount, {
        ownershipType: "eoa"
      })

      const expectedCalldata = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "cleanOwnershipData",
        args: [MOCK_EOA_ADDRESS]
      })

      expect((instructions[0].calls[0] as { data: Hex }).data).toBe(expectedCalldata)
    })

    test("should respect chainIds filter", () => {
      const instructions = cleanOwnership(mockAccount, {
        ownershipType: "eoa",
        chainIds: [10]
      })
      expect(instructions).toHaveLength(1)
      expect(instructions[0].chainId).toBe(10)
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

  // Arbitrary p256 ownership data (x || y coordinates)
  const p256OwnershipData = encodePacked(
    ["bytes32", "bytes32"],
    [
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex,
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex
    ]
  )

  const changedP256OwnershipData = encodePacked(
    ["bytes32", "bytes32"],
    [
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef" as Hex,
      "0xcafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe" as Hex
    ]
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
      const statelessValidator = deployment.version.submodules?.P256StatelessValidator

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
        result.data === "0x" ||
          result.data === "0x0" ||
          result.data.length <= 4
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
