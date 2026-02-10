import {
  http,
  type Address,
  type WalletClient,
  createWalletClient,
  encodePacked,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type StxSignatureType,
  getStxValidatorStubSignature,
  toStxValidator
} from "./toStxValidator"

describe("modules.toStxValidator", () => {
  let walletClient: WalletClient
  let mockEoaStatelessValidator: Address

  beforeAll(async () => {
    const account = privateKeyToAccount(generatePrivateKey())
    walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http()
    })
    // Mock EOA stateless validator address
    mockEoaStatelessValidator = "0xdD900Cd95f072eAe396bE0487C2546Bf81d01B48"
  })

  describe("Factory Function", () => {
    test("should create validator with default parameters", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator).toBeDefined()
      expect(validator.module).toBe(zeroAddress)
      expect(validator.type).toBe("validator")
      // initData should be encodePacked with stateless validator + safe senders count + ownership data
      expect(validator.initData).toBeDefined()
      expect(validator.initData.length).toBeGreaterThan(40) // More than just an address
      expect(validator.address).toBe(zeroAddress)
    })

    test("should create validator with custom signature type", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        signatureType: "permit",
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator).toBeDefined()
      expect(validator.getStubSignature).toBeDefined()
    })

    test("should support all signature types", () => {
      const signatureTypes: StxSignatureType[] = [
        "simple",
        "no-stx",
        "permit",
        "on-chain",
        "safe-sa"
      ]

      for (const signatureType of signatureTypes) {
        const validator = toStxValidator({
          walletClient,
          module: zeroAddress,
          signatureType,
          submodules: {
            EoaStatelessValidator: mockEoaStatelessValidator
          }
        })

        expect(validator).toBeDefined()
        expect(validator.module).toBe(zeroAddress)
      }
    })

    test("should throw error if walletClient has no account", () => {
      const walletClientNoAccount = createWalletClient({
        chain: sepolia,
        transport: http()
      })

      expect(() =>
        toStxValidator({
          walletClient: walletClientNoAccount,
          module: zeroAddress,
          submodules: {
            EoaStatelessValidator: mockEoaStatelessValidator
          }
        })
      ).toThrow("Account should be defined")
    })

    test("should accept custom superTxEntriesCount", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        superTxEntriesCount: 5,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator).toBeDefined()
    })

    test("should throw error if no statelessValidator or submodules provided", () => {
      expect(() =>
        toStxValidator({
          walletClient,
          module: zeroAddress
        })
      ).toThrow(
        "Either provide statelessValidator or submodules with EoaStatelessValidator address"
      )
    })

    test("should accept custom statelessValidator", () => {
      const customValidator = "0x1234567890123456789012345678901234567890"
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        statelessValidator: customValidator
      })

      expect(validator).toBeDefined()
      expect(validator.initData).toBeDefined()
    })

    test("should accept custom ownershipData", () => {
      const customOwnershipData = encodePacked(
        ["address"],
        [walletClient.account!.address]
      )
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        statelessValidator: mockEoaStatelessValidator,
        ownershipData: customOwnershipData
      })

      expect(validator).toBeDefined()
      expect(validator.initData).toBeDefined()
    })

    test("should accept safeSenders array", () => {
      const safeSender1 = "0x1111111111111111111111111111111111111111"
      const safeSender2 = "0x2222222222222222222222222222222222222222"
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        statelessValidator: mockEoaStatelessValidator,
        safeSenders: [safeSender1, safeSender2]
      })

      // Manually compose expected initData with safe senders
      const expectedOwnershipData = encodePacked(
        ["address"],
        [walletClient.account!.address]
      )
      const expectedInitData = encodePacked(
        ["address", "uint8", "address", "address", "bytes"],
        [
          mockEoaStatelessValidator,
          2,
          safeSender1,
          safeSender2,
          expectedOwnershipData
        ]
      )

      expect(validator.initData).toBe(expectedInitData)
      expect(validator.data).toBe(expectedInitData)
    })

    test("should support custom config with stxModeVerifier", () => {
      const customVerifier = "0x3333333333333333333333333333333333333333"
      const configId =
        "0x4444444444444444444444444444444444444444444444444444444444444444"
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        statelessValidator: mockEoaStatelessValidator,
        stxModeVerifier: customVerifier,
        configId
      })

      // Manually compose expected initData with custom config
      const expectedOwnershipData = encodePacked(
        ["address"],
        [walletClient.account!.address]
      )
      const expectedInitData = encodePacked(
        [
          "address", // statelessValidator
          "address", // stxModeVerifier
          "bytes32", // configId
          "uint8", // safeSendersCount (0)
          "bytes" // ownershipData
        ],
        [
          mockEoaStatelessValidator,
          customVerifier,
          configId,
          0,
          expectedOwnershipData
        ]
      )

      expect(validator.initData).toBe(expectedInitData)
      expect(validator.data).toBe(expectedInitData)
    })

    test("should support custom config with safeSenders", () => {
      const customVerifier = "0x3333333333333333333333333333333333333333"
      const configId =
        "0x4444444444444444444444444444444444444444444444444444444444444444"
      const safeSender1 = "0x5555555555555555555555555555555555555555"
      const safeSender2 = "0x6666666666666666666666666666666666666666"
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        statelessValidator: mockEoaStatelessValidator,
        stxModeVerifier: customVerifier,
        configId,
        safeSenders: [safeSender1, safeSender2]
      })

      // Manually compose expected initData with custom config and safe senders
      const expectedOwnershipData = encodePacked(
        ["address"],
        [walletClient.account!.address]
      )
      const expectedInitData = encodePacked(
        [
          "address", // statelessValidator
          "address", // stxModeVerifier
          "bytes32", // configId
          "uint8", // safeSendersCount (2)
          "address", // safeSender1
          "address", // safeSender2
          "bytes" // ownershipData
        ],
        [
          mockEoaStatelessValidator,
          customVerifier,
          configId,
          2,
          safeSender1,
          safeSender2,
          expectedOwnershipData
        ]
      )

      expect(validator.initData).toBe(expectedInitData)
      expect(validator.data).toBe(expectedInitData)
    })
  })

  describe("Stub Signature Generation", () => {
    test("should generate stub for simple mode with correct prefix", () => {
      const stub = getStxValidatorStubSignature("simple", 3)

      expect(stub).toBeDefined()
      expect(stub.startsWith("0x177eee00")).toBe(true)
      expect(stub.length).toBeGreaterThan(200) // Has merkle proof
    })

    test("should generate stub for permit mode with correct prefix", () => {
      const stub = getStxValidatorStubSignature("permit", 3)

      expect(stub).toBeDefined()
      expect(stub.startsWith("0x177eee01")).toBe(true)
    })

    test("should generate stub for on-chain mode with correct prefix", () => {
      const stub = getStxValidatorStubSignature("on-chain", 3)

      expect(stub).toBeDefined()
      expect(stub.startsWith("0x177eee02")).toBe(true)
    })

    test("should generate stub for safe-sa mode with correct prefix", () => {
      const stub = getStxValidatorStubSignature("safe-sa", 3)

      expect(stub).toBeDefined()
      expect(stub.startsWith("0x177eee04")).toBe(true)
    })

    test("should return DUMMY_SIGNATURE for no-stx mode", () => {
      const stub = getStxValidatorStubSignature("no-stx", 3)

      expect(stub).toBe(DUMMY_SIGNATURE)
    })

    test("should scale merkle proof size with superTxEntriesCount", () => {
      const stub1 = getStxValidatorStubSignature("simple", 1)
      const stub2 = getStxValidatorStubSignature("simple", 7)

      // More entries = larger proof
      expect(stub2.length).toBeGreaterThan(stub1.length)
    })

    test("should generate consistent stubs for same parameters", () => {
      const stub1 = getStxValidatorStubSignature("simple", 3)
      const stub2 = getStxValidatorStubSignature("simple", 3)

      expect(stub1).toBe(stub2)
    })

    test("should generate different stubs for different modes", () => {
      const simpleStub = getStxValidatorStubSignature("simple", 3)
      const permitStub = getStxValidatorStubSignature("permit", 3)

      expect(simpleStub).not.toBe(permitStub)
    })
  })

  describe("ERC-7739 Support", () => {
    test("should return version 1 for erc7739VersionSupported", async () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      const version = await validator.erc7739VersionSupported()
      expect(version).toBe(1)
    })

    test("should implement signMessageErc7739 function", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.signMessageErc7739).toBeDefined()
      expect(typeof validator.signMessageErc7739).toBe("function")
    })

    test("should implement signTypedDataErc7739 function", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.signTypedDataErc7739).toBeDefined()
      expect(typeof validator.signTypedDataErc7739).toBe("function")
    })
  })

  describe("Module Properties", () => {
    test("should set correct initData (encoded format)", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      // Manually compose expected initData
      const expectedOwnershipData = encodePacked(
        ["address"],
        [walletClient.account!.address]
      )
      const expectedInitData = encodePacked(
        ["address", "uint8", "bytes"],
        [mockEoaStatelessValidator, 0, expectedOwnershipData]
      )

      // Verify initData matches expected encoding
      expect(validator.initData).toBe(expectedInitData)
      expect(validator.data).toBe(expectedInitData)
      expect(validator.initData).toBe(validator.data)
    })

    test("should set correct module address", () => {
      const moduleAddress = "0x1234567890123456789012345678901234567890"
      const validator = toStxValidator({
        walletClient,
        module: moduleAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.module).toBe(moduleAddress)
      expect(validator.address).toBe(moduleAddress)
    })

    test("should set type as validator", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.type).toBe("validator")
    })

    test("should expose getStubSignature async function", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.getStubSignature).toBeDefined()
      expect(typeof validator.getStubSignature).toBe("function")
    })

    test("should expose signMessage function", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.signMessage).toBeDefined()
      expect(typeof validator.signMessage).toBe("function")
    })

    test("should expose signTypedData function", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.signTypedData).toBeDefined()
      expect(typeof validator.signTypedData).toBe("function")
    })

    test("should set deInitData to 0x", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      expect(validator.deInitData).toBe("0x")
    })
  })

  describe("Snapshot Consistency", () => {
    test("should have consistent module structure", () => {
      const validator = toStxValidator({
        walletClient,
        module: zeroAddress,
        signatureType: "simple",
        superTxEntriesCount: 3,
        submodules: {
          EoaStatelessValidator: mockEoaStatelessValidator
        }
      })

      // Verify all expected properties exist
      expect(validator).toHaveProperty("module")
      expect(validator).toHaveProperty("type")
      expect(validator).toHaveProperty("initData")
      expect(validator).toHaveProperty("data")
      expect(validator).toHaveProperty("deInitData")
      expect(validator).toHaveProperty("address")
      expect(validator).toHaveProperty("signMessage")
      expect(validator).toHaveProperty("signTypedData")
      expect(validator).toHaveProperty("signMessageErc7739")
      expect(validator).toHaveProperty("signTypedDataErc7739")
      expect(validator).toHaveProperty("getStubSignature")
      expect(validator).toHaveProperty("erc7739VersionSupported")
    })
  })
})
