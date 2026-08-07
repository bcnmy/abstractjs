import {
  MOCK_SIGNATURE_VALIDATOR,
  TOKEN_WITH_PERMIT
} from "@biconomy/ecosystem"
import { getAddress, getBytes, hexlify } from "ethers"
import {
  http,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type WalletClient,
  concat,
  concatHex,
  createWalletClient,
  domainSeparator,
  encodeAbiParameters,
  encodePacked,
  getContract,
  hashMessage,
  isAddress,
  isHex,
  keccak256,
  parseAbi,
  parseAbiParameters,
  parseEther,
  toBytes,
  toHex
} from "viem"
import type { UserOperation } from "viem/account-abstraction"
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"
import { MockSignatureValidatorAbi } from "../../test/__contracts/abi/MockSignatureValidatorAbi"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../test/testSetup"
import {
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient
} from "../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import {
  type NexusClient,
  createSmartAccountClient
} from "../clients/createBicoBundlerClient"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../constants"
import { TokenWithPermitAbi } from "../constants/abi/TokenWithPermitAbi"
import { getLegacyMEEVersion, getMEEVersion } from "../modules"
import { toOwnableModule } from "../modules/validators/ownable"
import { type NexusAccount, toNexusAccount } from "./toNexusAccount"
import {
  addressEquals,
  getAccountDomainStructFields,
  getAccountMeta
} from "./utils"
import {
  NEXUS_DOMAIN_NAME,
  NEXUS_DOMAIN_TYPEHASH,
  NEXUS_DOMAIN_VERSION,
  PARENT_TYPEHASH,
  SIG_TYPE_NO_STX_P256,
  SIG_TYPE_NO_STX_VANILLA_1271_EOA,
  SIG_TYPE_NO_STX_VANILLA_1271_P256,
  eip1271MagicValue
} from "./utils/Constants"
import type { BytesLike } from "./utils/Types"
import { unwrapSignature6492 } from "./utils/Utils"
import { toP256Signer } from "./utils/toP256Signer"

describe("nexus.account", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  let userTwo: LocalAccount
  let nexusAccountAddress: Address
  let nexusClient: NexusClient
  let nexusAccount: NexusAccount
  let walletClient: WalletClient

  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    userTwo = getTestAccount(1)

    testClient = toTestClient(chain, getTestAccount(5))

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain,
        transport: http(network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    nexusClient = createSmartAccountClient({
      mock: true,
      account: nexusAccount,
      transport: http(bundlerUrl)
    })

    nexusAccount = nexusClient.account
    nexusAccountAddress = await nexusClient.account.getAddress()
    await fundAndDeployClients(testClient, [nexusClient])
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should check isValidSignature using EIP-6492", async () => {
    const undeployedAccount = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain,
        transport: http(network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      },
      index: 102n // undeployed
    })

    const message = "hello world"
    const undeployedAccountAddress = await undeployedAccount.getAddress()
    expect(await undeployedAccount.isDeployed()).toBe(false)

    // Sign the message using ERC-7739 PersonalSign flow (handled automatically by the SDK)
    const signature = await undeployedAccount.signMessage({ message })

    // Verify the signature using viem's verifyMessage (supports EIP-6492 for undeployed accounts)
    const viemResponse = await testClient.verifyMessage({
      address: undeployedAccountAddress,
      message,
      signature
    })

    expect(viemResponse).toBe(true)
  })

  test("should check isValidSignature PersonalSign is valid", async () => {
    const message = "hello world"

    // Sign the message using ERC-7739 PersonalSign flow (handled automatically by the SDK)
    const signature = await nexusAccount.signMessage({ message })

    // Verify using viem's verifyMessage
    const viemResponse = await testClient.verifyMessage({
      address: nexusAccountAddress,
      message,
      signature
    })

    // Verify by calling isValidSignature directly on the contract
    const contractResponse = await testClient.readContract({
      address: nexusAccountAddress,
      abi: parseAbi([
        "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
      ]),
      functionName: "isValidSignature",
      args: [hashMessage(message), signature]
    })

    expect(contractResponse).toBe(eip1271MagicValue)
    expect(viemResponse).toBe(true)
  })

  test("should verify signatures", async () => {
    const mockSigVerifierContract = getContract({
      address: MOCK_SIGNATURE_VALIDATOR as Address,
      abi: MockSignatureValidatorAbi,
      client: testClient
    })

    const message = "Hello World"
    const messageHash = keccak256(toBytes(message))

    // Sign with regular hash
    const signature = await eoaAccount.signMessage({
      message: { raw: messageHash }
    })

    // Sign with Ethereum signed message
    const ethSignature = await eoaAccount.signMessage({ message })

    const isValidRegular = await mockSigVerifierContract.read.verify([
      messageHash,
      signature,
      eoaAccount.address
    ])

    // Verify Ethereum signed message
    const ethMessageHash = hashMessage(message)
    const isValidEthSigned = await mockSigVerifierContract.read.verify([
      ethMessageHash,
      ethSignature,
      eoaAccount.address
    ])

    expect(isValidRegular).toBe(true)
    expect(isValidEthSigned).toBe(true)
  })

  test("should have 4337 account actions", async () => {
    const [
      isDeployed,
      counterfactualAddress,
      userOpHash,
      address,
      factoryArgs,
      stubSignature,
      signedMessage,
      nonce,
      initCode,
      encodedExecute,
      encodedExecuteBatch,
      entryPointVersion
    ] = await Promise.all([
      nexusAccount.isDeployed(),
      nexusAccount.getAddress(),
      nexusAccount.getUserOpHash({
        sender: eoaAccount.address,
        nonce: 0n,
        data: "0x",
        signature: "0x",
        verificationGasLimit: 1n,
        preVerificationGas: 1n,
        callData: "0x",
        callGasLimit: 1n,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n
      } as UserOperation),
      nexusAccount.getAddress(),
      nexusAccount.getFactoryArgs(),
      nexusAccount.getStubSignature(),
      nexusAccount.signMessage({ message: "hello" }),
      nexusAccount.getNonce(),
      nexusAccount.getInitCode(),
      nexusAccount.encodeExecute({ to: eoaAccount.address, value: 100n }),
      nexusAccount.encodeExecuteBatch([
        { to: eoaAccount.address, value: 100n }
      ]),
      nexusClient.account.entryPoint.version
    ])

    expect(isAddress(counterfactualAddress)).toBe(true)
    expect(isHex(userOpHash)).toBe(true)
    expect(isAddress(address)).toBe(true)
    expect(address).toBe(nexusAccountAddress)

    if (isDeployed) {
      expect(factoryArgs.factory).toBe(undefined)
      expect(factoryArgs.factoryData).toBe(undefined)
    } else {
      expect(isAddress(factoryArgs.factory!)).toBe(true)
      expect(isHex(factoryArgs.factoryData!)).toBe(true)
    }

    expect(isHex(stubSignature)).toBe(true)
    expect(isHex(signedMessage)).toBe(true)
    expect(typeof nonce).toBe("bigint")
    expect(initCode.indexOf(nexusAccount.factoryAddress) > -1).toBe(true)
    expect(typeof isDeployed).toBe("boolean")

    expect(isHex(encodedExecute)).toBe(true)
    expect(isHex(encodedExecuteBatch)).toBe(true)
    expect(entryPointVersion).toBe("0.7")
  })

  test("should test isValidSignature EIP712Sign to be valid with viem", async () => {
    const nexusAccountAddress = await nexusAccount.getAddress()

    const message = {
      contents: keccak256(toBytes("test", { size: 32 }))
    }
    const meta = await getAccountMeta(testClient, nexusAccountAddress)

    // Calculate the domain separator
    const domainSeparator = keccak256(
      encodeAbiParameters(
        parseAbiParameters("bytes32, bytes32, bytes32, uint256, address"),
        [
          keccak256(toBytes(NEXUS_DOMAIN_TYPEHASH)),
          keccak256(toBytes(meta.name)),
          keccak256(toBytes(meta.version)),
          BigInt(chain.id),
          nexusAccountAddress
        ]
      )
    )

    const typedHashHashed = keccak256(
      concat(["0x1901", domainSeparator, message.contents])
    )

    const accountDomainStructFields = await getAccountDomainStructFields(
      testClient as unknown as PublicClient,
      nexusAccountAddress
    )

    const parentStructHash = keccak256(
      encodePacked(
        ["bytes", "bytes"],
        [
          encodeAbiParameters(parseAbiParameters(["bytes32, bytes32"]), [
            keccak256(toBytes(PARENT_TYPEHASH)),
            message.contents
          ]),
          accountDomainStructFields
        ]
      )
    )

    const dataToSign = keccak256(
      concat(["0x1901", domainSeparator, parentStructHash])
    )

    const signature = await walletClient.signMessage({
      account: eoaAccount,
      message: { raw: toBytes(dataToSign) }
    })

    const contentsType = toBytes("Contents(bytes32 stuff)")

    const signatureData = concatHex([
      signature,
      domainSeparator,
      message.contents,
      toHex(contentsType),
      toHex(contentsType.length, { size: 2 })
    ])

    const finalSignature = encodePacked(
      ["address", "bytes"],
      [nexusAccount.getModule().address, signatureData]
    )

    const contractResponse = await testClient.readContract({
      address: nexusAccountAddress,
      abi: parseAbi([
        "function isValidSignature(bytes32,bytes) external view returns (bytes4)"
      ]),
      functionName: "isValidSignature",
      args: [typedHashHashed, finalSignature]
    })

    expect(contractResponse).toBe(eip1271MagicValue)
  })

  test("check that ethers makeNonceKey creates the same key as the SDK", async () => {
    function makeNonceKey(
      vMode: BytesLike,
      validator: Hex,
      batchId: BytesLike
    ): string {
      // Convert the validator address to a Uint8Array
      const validatorBytes = getBytes(getAddress(validator.toString()))

      // Prepare the validation mode as a 1-byte Uint8Array
      const validationModeBytes = Uint8Array.from([Number(vMode)])

      // Convert the batchId to a Uint8Array (assuming it's 3 bytes)
      const batchIdBytes = getBytes(batchId)

      // Create a 24-byte array for the 192-bit key
      const keyBytes = new Uint8Array(24)

      // Set the batchId in the most significant 3 bytes (positions 0, 1, and 2)
      keyBytes.set(batchIdBytes, 0)

      // Set the validation mode at the 4th byte (position 3)
      keyBytes.set(validationModeBytes, 3)

      // Set the validator address starting from the 5th byte (position 4)
      keyBytes.set(validatorBytes, 4)

      // Return the key as a hex string
      return hexlify(keyBytes)
    }

    function numberTo3Bytes(key: bigint): Uint8Array {
      // todo: check range
      const buffer = new Uint8Array(3)
      buffer[0] = Number((key >> 16n) & 0xffn)
      buffer[1] = Number((key >> 8n) & 0xffn)
      buffer[2] = Number(key & 0xffn)
      return buffer
    }

    function toHexString(key: bigint): string {
      const key_ = numberTo3Bytes(key)
      return `0x${Array.from(key_)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")}`
    }

    const nonce = 5n
    const nonceAsHex = toHexString(nonce)

    const keyFromEthers = makeNonceKey(
      "0x00",
      nexusClient.account.getModule().address,
      nonceAsHex
    )
    const keyFromViem = concat([
      toHex(nonce, { size: 3 }),
      "0x00",
      nexusClient.account.getModule().address
    ])

    const keyWithHardcodedValues = concat([
      "0x000005",
      "0x00",
      nexusClient.account.getModule().address
    ])

    expect(addressEquals(keyFromViem, keyFromEthers)).toBe(true)
    expect(addressEquals(keyWithHardcodedValues, keyFromEthers)).toBe(true)
  })
})

// ====================================
// Unit Tests for Signing Methods
// ====================================
describe("nexus.account - signing methods", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string
  let testClient: MasterClient
  let eoaAccount: LocalAccount

  const versions = [
    { version: MEEVersion.V2_0_0, label: "V2.0.0" },
    { version: MEEVersion.V2_2_1, label: "V2.2.1" },
    { version: MEEVersion.V3_0_0, label: "V3.0.0" }
  ]

  // Maps for storing accounts by version
  const accountsByVersion = new Map<MEEVersion, NexusAccount>()
  const addressesByVersion = new Map<MEEVersion, Address>()

  // P256 account for V3.0.0
  let p256Account: NexusAccount
  let p256AccountAddress: Address

  // Setup accounts for all versions in a single beforeAll
  beforeAll(async () => {
    // Use real testnet for chain configuration
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    chain = network.chain
    eoaAccount = network.account!

    // Create accounts for all versions (no deployment needed for unit tests)
    for (const { version } of versions) {
      const account = await toNexusAccount({
        signer: eoaAccount,
        chainConfiguration: {
          chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(version)
        },
        index: BigInt(100 + version.charCodeAt(0)) // Use different index for each version
      })

      const address = await account.getAddress()

      accountsByVersion.set(version, account)
      addressesByVersion.set(version, address)
    }

    // Create V3.0.0 account with P256 signer
    const p256PrivateKey =
      "0x1234567890123456789012345678901234567890123456789012345678901234"
    const p256Signer = toP256Signer(p256PrivateKey)

    p256Account = await toNexusAccount({
      signer: p256Signer,
      chainConfiguration: {
        chain,
        transport: http(network.rpcUrl),
        version: getLegacyMEEVersion(MEEVersion.V3_0_0)
      },
      index: 200n
    })

    p256AccountAddress = await p256Account.getAddress()
  }, 60000)

  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  describe.each(versions)(
    "$label - signTypedData unit tests",
    ({ version }) => {
      let account: NexusAccount
      let accountAddress: Address

      beforeAll(() => {
        account = accountsByVersion.get(version)!
        accountAddress = addressesByVersion.get(version)!
      })

      test("should use ERC-7739 flow when module supports 7739", async () => {
        // Verify default module supports 7739
        expect(await account.getModule().erc7739VersionSupported()).not.toBe(0)

        const appDomain = {
          chainId: chain.id,
          name: "Test",
          verifyingContract: accountAddress,
          version: "1"
        }

        const types = {
          Message: [{ name: "content", type: "string" }]
        }

        const message = {
          content: "Hello ERC-7739"
        }

        const signature = await account.signTypedData({
          domain: appDomain,
          primaryType: "Message",
          types,
          message
        })

        const result = unwrapSignature6492(signature)
        const unwrappedSignature = result.originalSignature

        // Signature format validation
        expect(unwrappedSignature).toMatch(/^0x[0-9a-fA-F]+$/)
        expect(unwrappedSignature.startsWith("0x")).toBe(true)

        // For 7739, signature is longer than vanilla (includes appended domain/type data)
        // Vanilla would be: 42 (module) + 130 (ECDSA) = 172 chars
        expect(unwrappedSignature.length).toBeGreaterThan(172)

        // verify signature via 6492
        const valid = await account.publicClient.verifyTypedData({
          address: await account.getAddress(),
          signature: signature,
          domain: appDomain,
          primaryType: "Message",
          types,
          message: message
        })
        expect(valid).toBe(true)
      })
    }
  )

  describe.each(versions)("$label - signMessage unit tests", ({ version }) => {
    let account: NexusAccount

    beforeAll(() => {
      account = accountsByVersion.get(version)!
    })

    test("should use ERC-7739 PersonalSign flow when module supports 7739", async () => {
      // Verify default module supports 7739
      expect(await account.getModule().erc7739VersionSupported()).not.toBe(0)

      const message = "test message for 7739"
      const signature = await account.signMessage({ message })

      const result = unwrapSignature6492(signature)
      const unwrappedSignature = result.originalSignature

      // Signature format validation
      expect(unwrappedSignature).toMatch(/^0x[0-9a-fA-F]+$/)
      expect(unwrappedSignature.startsWith("0x")).toBe(true)

      // for personal sign, the signature is jusr r | s | v as per erc-7739
      expect(unwrappedSignature.length).toBe(172)

      // verify signature via 6492
      const valid = await account.publicClient.verifyMessage({
        address: await account.getAddress(),
        message: message,
        signature: signature
      })
      expect(valid).toBe(true)
    })
  })

  describe.each(versions)(
    "$label - signMessage1271 unit tests",
    ({ version, label }) => {
      let account: NexusAccount

      beforeAll(() => {
        account = accountsByVersion.get(version)!
      })

      test("should always use vanilla 1271 flow, never ERC-7739", async () => {
        // Even though the module supports 7739, signMessage1271 should use vanilla flow
        expect(await account.getModule().erc7739VersionSupported()).not.toBe(0)

        const message = `test vanilla 1271 explicit ${label}`
        const signature = await account.signMessage1271({ message })

        const result = unwrapSignature6492(signature)
        const unwrappedSignature = result.originalSignature
        expect(result.isWrapped).toBe(true)

        // Should start with module address
        expect(
          unwrappedSignature.startsWith(
            account.getModule().module.toLowerCase()
          )
        ).toBe(true)

        // Version-specific assertions
        if (version === MEEVersion.V3_0_0) {
          // V3.0.0: module (20) + prefix (4) + signature (65) = 89 bytes = 180 hex chars
          expect(unwrappedSignature.length).toBe(180)
          // Verify prefix is SIG_TYPE_NO_STX_VANILLA_1271_EOA (0x177eee05)
          const prefix = `0x${unwrappedSignature.slice(42, 50)}`
          expect(prefix).toBe(SIG_TYPE_NO_STX_VANILLA_1271_EOA)
        } else {
          // V2.x.x: module (20) + signature (65) = 85 bytes = 172 hex chars (no prefix)
          expect(unwrappedSignature.length).toBe(172)
        }

        // verify signature via 6492
        const valid = await account.publicClient.verifyMessage({
          address: await account.getAddress(),
          message: message,
          signature: signature
        })
        expect(valid).toBe(true)
      })
    }
  )

  describe("V3.0.0 with P256 signer", () => {
    test("signTypedData should include SIG_TYPE_NO_STX_P256 prefix", async () => {
      const accountAddress = await p256Account.getAddress()

      const appDomain = {
        chainId: chain.id,
        name: "Test",
        verifyingContract: accountAddress,
        version: "1"
      }

      const types = {
        Message: [{ name: "content", type: "string" }]
      }

      const message = {
        content: "Hello P256 ERC-7739"
      }

      const signature = await p256Account.signTypedData({
        domain: appDomain,
        primaryType: "Message",
        types,
        message
      })

      const result = unwrapSignature6492(signature)
      const unwrappedSignature = result.originalSignature

      // Signature format validation
      expect(unwrappedSignature).toMatch(/^0x[0-9a-fA-F]+$/)

      // V3.0.0 P256 with ERC-7739: signature is longer than vanilla due to 7739 data
      expect(unwrappedSignature.length).toBeGreaterThan(178)

      // Verify the P256 prefix (0x177eee12) is embedded in the signature
      const prefix = `0x${unwrappedSignature.slice(42, 50)}`
      expect(prefix).toBe(SIG_TYPE_NO_STX_P256)
    })

    test("signMessage should include SIG_TYPE_NO_STX_P256 prefix", async () => {
      const message = "test P256 message"
      const signature = await p256Account.signMessage({ message })

      const result = unwrapSignature6492(signature)
      const unwrappedSignature = result.originalSignature

      // Signature format validation
      expect(unwrappedSignature).toMatch(/^0x[0-9a-fA-F]+$/)

      // V3.0.0 P256 with ERC-7739: signature is longer than vanilla due to 7739 data
      expect(unwrappedSignature.length).toBe(178)

      // Verify the P256 prefix (0x177eee12) is embedded in the signature
      // For ERC-7739, the prefix is part of the complex signature structure, not at a fixed position
      const prefix = `0x${unwrappedSignature.slice(42, 50)}`
      expect(prefix).toBe(SIG_TYPE_NO_STX_P256)
    })

    test("signMessage1271 should use SIG_TYPE_NO_STX_VANILLA_1271_P256 prefix", async () => {
      const message = "test P256 vanilla 1271"
      const signature = await p256Account.signMessage1271({ message })

      const result = unwrapSignature6492(signature)
      const unwrappedSignature = result.originalSignature
      expect(result.isWrapped).toBe(true)

      // Should start with module address
      expect(
        unwrappedSignature.startsWith(
          p256Account.getModule().module.toLowerCase()
        )
      ).toBe(true)

      // V3.0.0 P256: module (20) + prefix (4) + P256 signature (64) = 88 bytes = 178 hex chars
      expect(unwrappedSignature.length).toBe(178)

      // Verify prefix is SIG_TYPE_NO_STX_VANILLA_1271_P256 (0x177eee11)
      // Note: Different prefix from signMessage/signTypedData!
      const prefix = `0x${unwrappedSignature.slice(42, 50)}`
      expect(prefix).toBe(SIG_TYPE_NO_STX_VANILLA_1271_P256)
    })
  })
})
