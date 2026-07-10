import {
  type Address,
  type Client,
  type Hash,
  type Hex,
  type PublicClient,
  type TypedData,
  type TypedDataDomain,
  type TypedDataParameter,
  concat,
  createPublicClient,
  decodeAbiParameters,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  hexToBytes,
  isAddress,
  isHex,
  keccak256,
  numberToHex,
  pad,
  padHex,
  parseAbi,
  parseAbiParameters,
  publicActions,
  stringToBytes,
  toBytes,
  toHex
} from "viem"
import type { Transport } from "viem"
import type { Chain } from "viem/chains"
import {
  BICONOMY_TOKEN_PAYMASTER,
  MOCK_MULTI_MODULE_ADDRESS,
  MODULE_ENABLE_MODE_TYPE_HASH,
  NEXUS_DOMAIN_NAME,
  NEXUS_DOMAIN_TYPEHASH,
  NEXUS_DOMAIN_VERSION
} from "../../account/utils/Constants"
import { MEEVersion } from "../../constants"
import { EIP1271Abi } from "../../constants/abi"
import {
  type AnyData,
  type ModuleType,
  moduleTypeIds
} from "../../modules/utils/Types"
import type { AccountMetadata, EIP712DomainReturn } from "./Types"
import { isVersionOlder, versionIsAtLeast } from "./getVersion"
import type { MeeVersionsWithChainId } from "./getVersion"

/**
 * Type guard to check if a value is null or undefined.
 *
 * @param value - The value to check
 * @returns True if the value is null or undefined
 */
export const isNullOrUndefined = (value: AnyData): value is undefined => {
  return value === null || value === undefined
}

/**
 * Checks if the provided value can be safely converted to a BigInt.
 *
 * @param value - The value to check for BigInt compatibility.
 * @returns True if the value can be converted to BigInt, false otherwise.
 */
export const isBigInt = (value: AnyData) => {
  try {
    // Attempt to convert the value to BigInt.
    BigInt(value)
    return true
  } catch {
    // If conversion fails, value is not a valid BigInt.
    return false
  }
}

export const toBytes32 = (
  value: bigint | boolean | Address | Hex | number
): Hex => {
  if (typeof value === "boolean") {
    return padHex(toHex(value ? 1n : 0n), { size: 32 })
  }

  if (typeof value === "bigint") {
    return padHex(toHex(value), { size: 32 })
  }

  if (typeof value === "number") {
    return padHex(toHex(BigInt(value)), { size: 32 })
  }

  if (isAddress(value)) {
    return padHex(value, { size: 32 })
  }

  if (isHex(value)) {
    return padHex(value, { size: 32 })
  }

  throw new Error(
    "Invalid value: must be boolean, bigint, address, or hex string"
  )
}

/**
 * Removes all HTTP/HTTPS URLs from the provided string.
 *
 * @param value - The string to sanitize.
 * @returns The sanitized string with URLs removed.
 */
export const sanitizeUrl = (value: string) => {
  // Replace all occurrences of http:// or https:// followed by non-whitespace characters with an empty string.
  return value.replace(/https?:\/\/[^\s]+/g, "")
}

/**
 * Validates if a string is a valid RPC URL.
 *
 * @param url - The URL to validate
 * @returns True if the URL is a valid RPC endpoint
 */
export const isValidRpcUrl = (url: string): boolean => {
  const regex = /^(http:\/\/|wss:\/\/|https:\/\/).*/
  return regex.test(url)
}

/**
 * Compares two addresses for equality, case-insensitive.
 *
 * @param a - First address
 * @param b - Second address
 * @returns True if addresses are equal
 */
export const addressEquals = (a?: string, b?: string): boolean =>
  !!a && !!b && a?.toLowerCase() === b.toLowerCase()

export const isNativeToken = (tokenAddress: Address): boolean =>
  addressEquals(tokenAddress, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") ||
  addressEquals(tokenAddress, "0x0000000000000000000000000000000000000000")

/**
 * Parameters for wrapping a signature according to EIP-6492.
 */
export type SignWith6492Params = {
  /** The factory contract address */
  factoryAddress: Address
  /** The factory initialization calldata */
  factoryCalldata: Hex
  /** The original signature to wrap */
  signature: Hash
}

/**
 * The EIP-6492 magic suffix used to identify wrapped signatures.
 */
export const ERC6492_MAGIC_BYTES: Hex =
  "0x6492649264926492649264926492649264926492649264926492649264926492"

/**
 * Wraps a signature according to EIP-6492 specification.
 *
 * @param params - Parameters including factory address, calldata, and signature
 * @returns The wrapped signature
 */
export const wrapSignatureWith6492 = ({
  factoryAddress,
  factoryCalldata,
  signature
}: SignWith6492Params): Hash => {
  // wrap the signature as follows: https://eips.ethereum.org/EIPS/eip-6492
  // concat(
  //  abi.encode(
  //    (create2Factory, factoryCalldata, originalERC1271Signature),
  //    (address, bytes, bytes)),
  //    magicBytes
  // )
  return concat([
    encodeAbiParameters(parseAbiParameters("address, bytes, bytes"), [
      factoryAddress,
      factoryCalldata,
      signature
    ]),
    ERC6492_MAGIC_BYTES
  ])
}

/**
 * Result of unwrapping an EIP-6492 signature.
 */
export type UnwrapSignature6492Result = {
  /** Whether the signature was wrapped with EIP-6492 */
  isWrapped: boolean
  /** The original signature (unwrapped if it was wrapped) */
  originalSignature: Hex
  /** The factory contract address (only present if wrapped) */
  factoryAddress?: Address
  /** The factory initialization calldata (only present if wrapped) */
  factoryCalldata?: Hex
}

/**
 * Unwraps an EIP-6492 signature if it's wrapped, otherwise returns the original signature.
 *
 * EIP-6492 signatures are used to validate signatures for contracts that haven't been deployed yet.
 * They wrap the original signature with factory deployment information.
 *
 * @param wrappedSignature - The potentially wrapped signature to unwrap
 * @returns An object containing the unwrapped signature and deployment information if wrapped
 *
 * @example
 * ```ts
 * const result = unwrapSignature6492(signature)
 * if (result.isWrapped) {
 *   console.log('Factory:', result.factoryAddress)
 *   console.log('Original signature:', result.originalSignature)
 * } else {
 *   console.log('Not wrapped, using signature as-is')
 * }
 * ```
 */
export const unwrapSignature6492 = (
  wrappedSignature: Hex
): UnwrapSignature6492Result => {
  // Check if signature ends with EIP-6492 magic bytes
  if (!wrappedSignature.endsWith(ERC6492_MAGIC_BYTES.slice(2))) {
    return {
      isWrapped: false,
      originalSignature: wrappedSignature
    }
  }

  // Remove magic bytes (32 bytes = 64 hex chars)
  const signatureWithoutMagic = wrappedSignature.slice(0, -64) as Hex

  // Decode the ABI-encoded data: (address, bytes, bytes)
  const decoded = decodeAbiParameters(
    parseAbiParameters("address, bytes, bytes"),
    signatureWithoutMagic
  )

  return {
    isWrapped: true,
    factoryAddress: decoded[0],
    factoryCalldata: decoded[1],
    originalSignature: decoded[2]
  }
}

/**
 * Calculates the percentage of a partial value relative to a total value.
 *
 * @param partialValue - The partial value
 * @param totalValue - The total value
 * @returns The percentage as a number
 */
export function percentage(partialValue: number, totalValue: number) {
  return (100 * partialValue) / totalValue
}

/**
 * Converts a percentage to a factor (e.g., 50% -> 1.5).
 *
 * @param percentage - The percentage value (1-100)
 * @returns The converted factor
 * @throws If percentage is outside valid range
 */
export function convertToFactor(percentage: number | undefined): number {
  // Check if the input is within the valid range
  if (percentage) {
    if (percentage < 1 || percentage > 100) {
      throw new Error("The percentage value should be between 1 and 100.")
    }

    // Calculate the factor
    const factor = percentage / 100 + 1

    return factor
  }
  return 1
}

/**
 * Generates installation data and hash for module installation.
 *
 * @param accountOwner - The account owner address
 * @param modules - Array of modules with their types and configurations
 * @param domainName - Optional domain name
 * @param domainVersion - Optional domain version
 * @returns Tuple of [installData, hash]
 */
export function makeInstallDataAndHash(
  accountOwner: Address,
  modules: { type: ModuleType; config: Hex }[],
  domainName = NEXUS_DOMAIN_NAME,
  domainVersion = NEXUS_DOMAIN_VERSION
): [string, string] {
  const types = modules.map((module) => BigInt(moduleTypeIds[module.type]))
  const initDatas = modules.map((module) =>
    toHex(concat([toBytes(BigInt(moduleTypeIds[module.type])), module.config]))
  )

  const multiInstallData = encodeAbiParameters(
    [{ type: "uint256[]" }, { type: "bytes[]" }],
    [types, initDatas]
  )

  const structHash = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "address" }, { type: "bytes32" }],
      [
        MODULE_ENABLE_MODE_TYPE_HASH,
        MOCK_MULTI_MODULE_ADDRESS,
        keccak256(multiInstallData)
      ]
    )
  )

  const hashToSign = _hashTypedData(
    structHash,
    domainName,
    domainVersion,
    accountOwner
  )

  return [multiInstallData, hashToSign]
}

export function _hashTypedData(
  structHash: Hex,
  name: string,
  version: string,
  verifyingContract: Address
): string {
  const DOMAIN_SEPARATOR = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" }
      ],
      [
        keccak256(stringToBytes(NEXUS_DOMAIN_TYPEHASH)),
        keccak256(stringToBytes(name)),
        keccak256(stringToBytes(version)),
        verifyingContract
      ]
    )
  )

  return keccak256(
    concat([
      stringToBytes("\x19\x01"),
      hexToBytes(DOMAIN_SEPARATOR),
      hexToBytes(structHash)
    ])
  )
}

export function getTypesForEIP712Domain({
  domain
}: {
  domain?: TypedDataDomain | undefined
}): TypedDataParameter[] {
  return [
    typeof domain?.name === "string" && { name: "name", type: "string" },
    domain?.version && { name: "version", type: "string" },
    typeof domain?.chainId === "number" && {
      name: "chainId",
      type: "uint256"
    },
    domain?.verifyingContract && {
      name: "verifyingContract",
      type: "address"
    },
    domain?.salt && { name: "salt", type: "bytes32" }
  ].filter(Boolean) as TypedDataParameter[]
}

/**
 * Retrieves account metadata including name, version, and chain ID.
 *
 * @param client - The viem Client instance
 * @param accountAddress - The account address to query
 * @returns Promise resolving to account metadata
 */
export const getAccountMeta = async (
  client: Client,
  accountAddress: Address
): Promise<AccountMetadata> => {
  try {
    const domain = await client.request({
      method: "eth_call",
      params: [
        {
          to: accountAddress,
          data: encodeFunctionData({
            abi: EIP1271Abi,
            functionName: "eip712Domain"
          })
        },
        "latest"
      ]
    })

    if (domain !== "0x") {
      const decoded = decodeFunctionResult({
        abi: EIP1271Abi,
        functionName: "eip712Domain",
        data: domain
      })
      return {
        name: decoded?.[1],
        version: decoded?.[2],
        chainId: decoded?.[3]
      }
    }
  } catch (error) {}
  return {
    name: NEXUS_DOMAIN_NAME,
    version: NEXUS_DOMAIN_VERSION,
    chainId: client.chain
      ? BigInt(client.chain.id)
      : BigInt(await client.extend(publicActions).getChainId())
  }
}

/**
 * Wraps a typed data hash with EIP-712 domain separator.
 *
 * @param typedHash - The hash to wrap
 * @param appDomainSeparator - The domain separator
 * @returns The wrapped hash
 */
export const eip712WrapHash = (typedHash: Hex, appDomainSeparator: Hex): Hex =>
  keccak256(concat(["0x1901", appDomainSeparator, typedHash]))

export type TypedDataWith712 = {
  EIP712Domain: TypedDataParameter[]
} & TypedData

export function typeToString(typeDef: TypedDataWith712): string[] {
  return Object.entries(typeDef).map(([key, fields]) => {
    const fieldStrings = (fields ?? [])
      .map((field) => `${field.type} ${field.name}`)
      .join(",")
    return `${key}(${fieldStrings})`
  })
}

/** @ignore */
export function bigIntReplacer(_key: string, value: AnyData) {
  return typeof value === "bigint" ? value.toString() : value
}

export function numberTo3Bytes(key: bigint): Uint8Array {
  // todo: check range
  const buffer = new Uint8Array(3)
  buffer[0] = Number((key >> 16n) & 0xffn)
  buffer[1] = Number((key >> 8n) & 0xffn)
  buffer[2] = Number(key & 0xffn)
  return buffer
}

export function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, "0")) // Convert each byte to hex and pad to 2 digits
    .join("") // Join all hex values together into a single string
}

export const getAccountDomainStructFields = async (
  publicClient: PublicClient,
  accountAddress: Address
) => {
  const accountDomainStructFields = (await publicClient.readContract({
    address: accountAddress,
    abi: parseAbi([
      "function eip712Domain() public view returns (bytes1 fields, string memory name, string memory version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] memory extensions)"
    ]),
    functionName: "eip712Domain"
  })) as EIP712DomainReturn

  const [, name, version, chainId, verifyingContract, salt] =
    accountDomainStructFields

  const params = parseAbiParameters([
    "bytes32",
    "bytes32",
    "uint256",
    "address",
    "bytes32"
  ])

  return encodeAbiParameters(params, [
    keccak256(toBytes(name)),
    keccak256(toBytes(version)),
    chainId,
    verifyingContract,
    salt
  ])
}

export const inProduction = () => {
  try {
    return process?.env?.environment === "production"
  } catch (e) {
    return true
  }
}

export const playgroundTrue = () => {
  try {
    return process?.env?.RUN_PLAYGROUND === "true"
  } catch (e) {
    return false
  }
}

type TenderlyDetails = {
  accountSlug: string
  projectSlug: string
  apiKey: string
}
export const getTenderlyDetails = (): TenderlyDetails | null => {
  try {
    const accountSlug = process?.env?.TENDERLY_ACCOUNT_SLUG
    const projectSlug = process?.env?.TENDERLY_PROJECT_SLUG
    const apiKey = process?.env?.TENDERLY_API_KEY

    if (!accountSlug || !projectSlug || !apiKey) {
      return null
    }

    return {
      accountSlug,
      projectSlug,
      apiKey
    }
  } catch (e) {
    return null
  }
}

/**
 * Safely multiplies a bigint by a number, rounding appropriately.
 *
 * @param bI - The bigint to multiply
 * @param multiplier - The multiplication factor
 * @returns The multiplied bigint
 */
export const safeMultiplier = (bI: bigint, multiplier: number): bigint =>
  BigInt(Math.round(Number(bI) * multiplier))

export type EthersWallet = {
  signTransaction: (...args: AnyData[]) => Promise<AnyData>
  signMessage: (...args: AnyData[]) => Promise<AnyData>
  signTypedData: (...args: AnyData[]) => Promise<AnyData>
  getAddress: () => Promise<AnyData>
  address: Address
  provider: AnyData
}

export const getAllowance = async (
  client: PublicClient,
  owner: Address,
  tokenAddress: Address,
  spender = BICONOMY_TOKEN_PAYMASTER
): Promise<bigint> => {
  const approval = await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender]
  })

  return approval as bigint
}

export function parseRequestArguments(input: string[]) {
  const fieldsToOmit = [
    "callGasLimit",
    "preVerificationGas",
    "maxFeePerGas",
    "maxPriorityFeePerGas",
    "paymasterAndData",
    "verificationGasLimit"
  ]

  // Skip the first element which is just "Request Arguments:"
  const argsString = input.slice(1).join("")

  // Split by newlines and filter out empty lines
  const lines = argsString.split("\n").filter((line) => line.trim())

  // Create an object from the key-value pairs
  const result = lines.reduce(
    (acc, line) => {
      // Remove extra spaces and split by ':'
      const [key, value] = line.split(":").map((s) => s.trim())

      // Clean up the key (remove trailing spaces and colons)
      const cleanKey = key.trim()

      // Clean up the value (remove 'gwei' and other units)
      const cleanValue: string | number = value.replace("gwei", "").trim()

      if (fieldsToOmit.includes(cleanKey)) {
        return acc
      }

      acc[cleanKey] = cleanValue
      return acc
    },
    {} as Record<string, string | number>
  )

  return result
}

/**
 * Checks if a chain supports Cancun.
 *
 * @param transport - The transport to use
 * @param chain - The chain to check
 * @returns True if the chain supports Cancun, false otherwise
 */
export async function supportsCancun({
  transport,
  chain
}: {
  transport: Transport
  chain: Chain
}): Promise<boolean> {
  const cancunSupportedChains: Record<string, boolean> = {
    "1": true,
    "11155111": true,
    "8453": true,
    "84532": true,
    "137": true,
    "80002": true,
    "42161": true,
    "421614": true,
    "10": true,
    "11155420": true,
    "56": true,
    "97": true,
    "146": true,
    "57054": true,
    "534352": true,
    "534351": true,
    "100": true,
    "10200": true,
    "43114": true,
    "43113": true,
    "33139": true,
    "33111": true,
    "999": true,
    "1116": true,
    "267": true,
    "1329": true,
    "1328": true,
    "130": true,
    "1301": true,
    "747474": true,
    "1135": true,
    "480": true,
    "4801": true,
    "20993": true,
    "10143": true,
    "143": true,
    "88882": false,
    "531050204": true,
    "5010405": true,
    // Robinhood Chain (Arbitrum Orbit): supports Cancun (TSTORE/MCOPY verified on-chain),
    // but like all Orbit chains its L2 blocks carry no blob-gas fields, so the dynamic
    // block-header fallback below misdetects it - same reason 42161/33139 are listed.
    "4663": true
  }

  if (cancunSupportedChains[chain.id.toString()]) {
    return cancunSupportedChains[chain.id.toString()]
  }

  const client = createPublicClient({
    chain,
    transport
  })

  // Fetch the latest block with full transactions
  const block = await client.getBlock({
    blockTag: "latest"
  })

  // Check for Cancun-specific block fields
  if (block.blobGasUsed !== undefined || block.excessBlobGas !== undefined) {
    return true
  }

  return false
}

/**
 * Calculate the storage slot for nonces in EntryPoint V7
 * Following exact Solidity storage layout rules from docs
 */
export function calculateNonceStorageSlot(sender: Address, key = 0n): Hex {
  const BASE_SLOT = 1 // nonceSequenceNumber is at slot 1

  // Step 1: Calculate slot for first mapping level
  // keccak256(abi.encode(address_key, uint256_slot))
  // Both address and slot are padded to 32 bytes
  const firstLevelSlot = keccak256(
    concat([
      pad(sender, { size: 32 }), // address padded to 32 bytes
      pad(numberToHex(BASE_SLOT), { size: 32 }) // slot padded to 32 bytes
    ])
  )

  // Step 2: Calculate slot for second mapping level
  // keccak256(abi.encode(uint192_key, bytes32_slot))
  const finalSlot = keccak256(
    concat([
      pad(numberToHex(key), { size: 32 }), // uint192 key padded to 32 bytes
      firstLevelSlot // already 32 bytes
    ])
  )

  return finalSlot
}

/**
 * Calculates the storage slot for "initializedSlots" mapping using a namespace and slot.
 *
 * This follows Solidity's rules for mapping storage layout. Used, for example, by
 * contracts that store initialization flags for a (namespace, slot) pair at mapping slot 0.
 *
 * Storage structure (Solidity pseudocode):
 *   mapping(bytes32 namespace => mapping(bytes32 slot => bool)) initializedSlots;
 *
 * The formula:
 *   keccak256(
 *     abi.encode(
 *       keccak256(abi.encode(namespace, slot)),
 *       uint256(BASE_SLOT)
 *     )
 *   )
 *
 * Both keys and slot are padded to 32 bytes. BASE_SLOT = 0 here.
 *
 * @param namespace - 32-byte hex string namespace identifier
 * @param slot - 32-byte hex string representing the individual slot
 * @returns The storage slot (as Hex) for (namespace, slot) in "initializedSlots"
 */
export function calculateNameSpaceStorageInitializationSlot(
  namespace: Hex,
  slot: Hex
): Hex {
  const BASE_SLOT = 0 // 'initializedSlots' mapping lives at storage slot 0

  // Step 1: keccak256(abi.encode(namespace, slot))
  // Both are padded to 32 bytes as per Solidity's abi.encode
  const namespacedSlot = keccak256(
    concat([pad(namespace, { size: 32 }), pad(slot, { size: 32 })])
  )

  // Step 2: keccak256(abi.encode(namespacedSlot, BASE_SLOT))
  // namespacedSlot is already 32 bytes; BASE_SLOT is padded to 32 bytes
  const mappingSlot = keccak256(
    concat([
      pad(namespacedSlot, { size: 32 }),
      pad(numberToHex(BASE_SLOT), { size: 32 }) // slot padding
    ])
  )

  return mappingSlot
}

/**
 * Checks if the account has consistent MEE versions across deployments for signing the quote.
 *
 * Version < 2.2.0 uses personal_sign, version >= 2.2.0 uses EIP-712 signing.
 * Mixing these two signing methods is not allowed as it would result in incompatible signatures.
 *
 * For EIP-712 versions (>= 2.2.0), all MEE versions must be the same to ensure consistent
 * signature validation across chains.
 *
 * @param meeVersions - Array of chain IDs with their corresponding MEE versions
 * @throws Error if versions are inconsistent or mixing signing methods
 */
export function validateConsistentMeeVersions(
  meeVersions: MeeVersionsWithChainId
): void {
  let hasPersonalSignVersion = false
  let hasEIP712Version = false

  // Track version consistency while iterating (fail-fast approach)
  for (const { version: meeVersionConfig } of meeVersions) {
    const meeVersion = meeVersionConfig.version
    // Check version type as we go
    const isCurrentVersionPersonalSign = isVersionOlder(
      meeVersion,
      MEEVersion.V2_2_1
    )
    const isCurrentVersionEIP712 = versionIsAtLeast(
      meeVersion,
      MEEVersion.V2_2_1
    )

    // Update flags
    hasPersonalSignVersion =
      hasPersonalSignVersion || isCurrentVersionPersonalSign
    hasEIP712Version = hasEIP712Version || isCurrentVersionEIP712

    // Early exit: Cannot mix personal_sign and EIP-712 signing methods
    if (hasPersonalSignVersion && hasEIP712Version) {
      throw new Error(
        "MEE versions on all chains should be whether less than 2.2.0 or greater than or equal to 2.2.0. " +
          "Otherwise Multichain account won't be able to consume the same signature across all chains involved in the quote request."
      )
    }
  }
}
