import {
  type Address,
  type Hex,
  type SignableMessage,
  type TypedDataDefinition,
  type TypedDataDomain,
  type WalletClient,
  concatHex,
  encodePacked,
  validateTypedData
} from "viem"
import { erc7739Actions } from "viem/experimental"
import type { MEEVersionConfig } from "../../../account/utils/getVersion"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

const MOCK_SUPERTXN_HASH_AND_TIMESTAMPS: Hex =
  "0x9e1cce57126e9205fe085888ed6b5ca0033f168e26b8927adb1c6da566cf7c5100000000000000000000000000000000000000000000000000000000642622800000000000000000000000000000000000000000000000000000000064262668"

export type StxSignatureType =
  | "simple"
  | "no-stx"
  | "permit"
  | "on-chain"
  | "safe-sa"

export type ToStxValidatorParameters = Omit<
  ValidatorParameters,
  "initData"
> & {
  walletClient: WalletClient
  signatureType?: StxSignatureType
  superTxEntriesCount?: number

  /**
   * Address of the stateless validator to use
   * Defaults to P256StatelessValidator or EoaStatelessValidator from submodules
   * based on the signer type
   */
  statelessValidator?: Address

  /**
   * Ownership data for the stateless validator
   * For EOA: auto-generated as encodePacked(['address'], [walletClient.account.address])
   * For P256: auto-generated as x || y (64 bytes) from the signer's publicKey
   * For other validators: must be provided by user as pre-encoded bytes
   */
  ownershipData?: Hex

  /**
   * Optional array of safe sender addresses
   * Defaults to empty array []
   */
  safeSenders?: Address[]

  // Custom config parameters (advanced use case)
  /**
   * Address of custom stxModeVerifier for advanced configuration
   * If provided, includes custom config in initData
   */
  stxModeVerifier?: Address

  /**
   * Config ID for custom stxModeVerifier
   * Only used when stxModeVerifier is provided
   */
  configId?: Hex

  /**
   * Submodules configuration from MEE version config
   * Used to get default EoaStatelessValidator address
   */
  submodules?: MEEVersionConfig["submodules"]
}

export const toStxValidator = (
  parameters: ToStxValidatorParameters
): Validator => {
  const { signatureType = "no-stx", superTxEntriesCount = 3 } = parameters
  if (!parameters.walletClient.account) {
    throw new Error(
      "Account should be defined in the wallet client provided to the module"
    )
  }

  // Prepare initData and data using encodePacked
  let initData: Hex

  // Detect P256 signer
  const isP256 = parameters.signer?.source === "p256"

  // Get stateless validator address (auto-select based on signer type)
  const statelessValidator =
    parameters.statelessValidator ??
    (isP256
      ? parameters.submodules?.P256StatelessValidator
      : parameters.submodules?.EoaStatelessValidator)

  // Prepare ownershipData based on signer type
  let ownershipData: Hex
  if (parameters.ownershipData) {
    ownershipData = parameters.ownershipData
  } else if (isP256 && parameters.signer) {
    // P256: ownership data is x || y (64 bytes) extracted from uncompressed public key (04 || x || y)
    const x = `0x${parameters.signer.publicKey.slice(4, 68)}` as Hex
    const y = `0x${parameters.signer.publicKey.slice(68, 132)}` as Hex
    ownershipData = encodePacked(["bytes32", "bytes32"], [x, y])
  } else {
    // EOA: ownership data is the account address
    ownershipData = encodePacked(
      ["address"],
      [parameters.walletClient.account.address]
    )
  }

  if (!statelessValidator) {
    throw new Error(
      "Either provide statelessValidator or submodules with a StatelessValidator address"
    )
  }

  // Prepare safe senders
  const safeSenders = parameters.safeSenders ?? []
  const safeSendersCount = safeSenders.length

  // Build initData using encodePacked based on whether custom config is provided
  if (parameters.stxModeVerifier && parameters.configId) {
    // Custom config format:
    // [statelessValidator(20) + stxModeVerifier(20) + configId(32) + safeSendersCount(1) + safeSenders(20*count) + ownershipData]
    const types: string[] = [
      "address", // statelessValidator
      "address", // stxModeVerifier
      "bytes32", // configId
      "uint8" // safeSendersCount
    ]
    const values: (Address | Hex | number)[] = [
      statelessValidator,
      parameters.stxModeVerifier,
      parameters.configId,
      safeSendersCount
    ]

    // Add safe sender addresses
    for (let i = 0; i < safeSendersCount; i++) {
      types.push("address")
      values.push(safeSenders[i])
    }

    // Add ownership data
    types.push("bytes")
    values.push(ownershipData)

    initData = encodePacked(
      types as readonly string[],
      values as unknown as Parameters<typeof encodePacked>[1]
    )
  } else {
    // Default format:
    // [statelessValidator(20) + safeSendersCount(1) + safeSenders(20*count) + ownershipData]
    const types: string[] = [
      "address", // statelessValidator
      "uint8" // safeSendersCount
    ]
    const values: (Address | Hex | number)[] = [
      statelessValidator,
      safeSendersCount
    ]

    // Add safe sender addresses
    for (let i = 0; i < safeSendersCount; i++) {
      types.push("address")
      values.push(safeSenders[i])
    }

    // Add ownership data
    types.push("bytes")
    values.push(ownershipData)

    initData = encodePacked(
      types as readonly string[],
      values as unknown as Parameters<typeof encodePacked>[1]
    )
  }

  const data = initData

  const walletClient7739 = parameters.walletClient.extend(erc7739Actions())

  /**
   * Signs a message using ERC-7739 PersonalSign flow
   * @param message - The message to sign
   * @param verifierDomain - The EIP-712 domain of the verifier (smart account)
   * @returns The ERC-7739 wrapped signature
   */
  const signMessageErc7739 = async (
    message: SignableMessage,
    verifierDomain: TypedDataDomain
  ): Promise<Hex> => {
    return await walletClient7739.signMessage({
      account: parameters.walletClient.account!,
      message,
      verifierDomain: verifierDomain as Required<
        Pick<
          TypedDataDomain,
          "chainId" | "name" | "verifyingContract" | "version"
        >
      >
    })
  }

  /**
   * Signs typed data using ERC-7739 TypedDataSign flow
   * @param typedData - The typed data to sign
   * @param verifierDomain - The EIP-712 domain of the verifier (smart account)
   * @returns The ERC-7739 wrapped signature
   */
  const signTypedDataErc7739 = async (
    typedData: TypedDataDefinition,
    verifierDomain: TypedDataDomain
  ): Promise<Hex> => {
    const { domain, types, primaryType, message } = typedData

    // Validate typed data before signing
    validateTypedData({ domain, types, primaryType, message })

    return await walletClient7739.signTypedData({
      account: parameters.walletClient.account!,
      domain: domain!,
      types: types!,
      primaryType: primaryType!,
      message: message!,
      verifierDomain: verifierDomain as Required<
        Pick<
          TypedDataDomain,
          "chainId" | "name" | "verifyingContract" | "version" | "salt"
        >
      >
    })
  }

  // Destructure signer out to avoid OneOf<{signer} | {walletClient}> type conflict
  // The walletClient already wraps the signer, so signing works correctly through it
  const { signer: _signer, ...restParameters } = parameters

  return toValidator({
    initData,
    data,
    deInitData: "0x",
    ...restParameters,
    address: parameters.module,
    module: parameters.module,
    type: "validator",
    signMessageErc7739,
    signTypedDataErc7739,
    getStubSignature: async () =>
      getStxValidatorStubSignature(signatureType, superTxEntriesCount),
    erc7739VersionSupported_: 1
  })
}

export const getStxValidatorStubSignature = (
  signatureType: StxSignatureType,
  superTxEntriesCount: number
): Hex => {
  // get the proof size for a given merkle tree size
  const leafCount = superTxEntriesCount + 1
  const proofSize = Math.ceil(Math.log2(leafCount))

  let prefix: Hex = "0x"
  let mockModePayload: Hex = "0x"

  if (signatureType === "no-stx") {
    return DUMMY_SIGNATURE
  }
  if (signatureType === "simple") {
    prefix = "0x177eee00"
    mockModePayload = concatHex([
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x00000000000000000000000000000000000000000000000000000000000000a0", // offsets
      "0x0000000000000000000000000000000000000000000000000000000000000100"
    ])
  }
  // for permit mode, on-chain mode, we imitate the sig structure
  // hex values are taken from a real signature for an according fusion mode
  // stub signatures are used to estimate gas and are not expected to be valid

  // here and below sample data from some random actual userOp encoding with preserved length are used to imitate the signature structure
  if (signatureType === "permit") {
    prefix = "0x177eee01"
    mockModePayload = concatHex([
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000001d1499e622d69689cdf9004d05ec547d650ff211000000000000000000000000a0cb889707d426a7a386870a03bc70d1b0697598fe8244a8453f6a5a1623e38a7117cfcadf84d670fe741a32e447cd5f5671a68b0000000000000000000000000000000000000000000000003782dace9d9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027d5730e3c64852e56f4f10c0c27a8d96651193fd13663c1dd652b5f18677458",
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000000250e2ad6bd90d6121dc5166dc6968f23ba43497594de5c7ca655f58e96d31775d"
    ])
  }
  if (signatureType === "on-chain") {
    prefix = "0x177eee02"
    mockModePayload = concatHex([
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000001d1499e622d69689cdf9004d05ec547d650ff211000000000000000000000000a0cb889707d426a7a386870a03bc70d1b0697598fe8244a8453f6a5a1623e38a7117cfcadf84d670fe741a32e447cd5f5671a68b000000000000000000000000000000000000000000000001158e460913d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x000000000000000000000000000000000000000000000000000000000000000568f7d0137aa459fc3d87c0405f9df08008c9b97b3da85ef4f663b0e4fc910b518146837426fd3167918049cae2bc9fdf90aabc1e9db16244b56a12463711c2d500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    ])
  }

  // Safe Smart Account mode stub signature
  if (signatureType === "safe-sa") {
    prefix = "0x177eee04"
    // Mock SafeTxnData encoding with domain separator, transaction params, and signatures
    mockModePayload = concatHex([
      "0x0000000000000000000000000000000000000000000000000000000000000020", // offset for tuple
      "0x47e79534a245952e8b16893a336b85a3d9ea9fa8fa568c00004d05ec547d0001", // ogDomainSeparator (mock)
      "0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // to (mock token address)
      "0x0000000000000000000000000000000000000000000000000000000000000000", // value (0)
      "0x0000000000000000000000000000000000000000000000000000000000000180", // data offset
      "0x0000000000000000000000000000000000000000000000000000000000000000", // operation (Call)
      "0x0000000000000000000000000000000000000000000000000000000000000000", // safeTxGas
      "0x0000000000000000000000000000000000000000000000000000000000000000", // baseGas
      "0x0000000000000000000000000000000000000000000000000000000000000000", // gasPrice
      "0x0000000000000000000000000000000000000000000000000000000000000000", // gasToken
      "0x0000000000000000000000000000000000000000000000000000000000000000", // refundReceiver
      "0x0000000000000000000000000000000000000000000000000000000000000000", // nonce
      "0x00000000000000000000000000000000000000000000000000000000000001c0", // signatures offset
      "0x0000000000000000000000000000000000000000000000000000000000000001", // executeTrigger (true)
      "0x0000000000000000000000000000000000000000000000000000000000000001", // chainId
      "0x0000000000000000000000000000000000000000000000000000000000000044", // data length
      "0x095ea7b3000000000000000000000000a0cb889707d426a7a386870a03bc70d1", // approve calldata (partial)
      "0x0b6975980000000000000000000000000000000000000000000000003782dace", // approve calldata + hash
      "0x0000000000000000000000000000000000000000000000000000000000000041", // signatures length
      DUMMY_SIGNATURE // mock signature
    ])
  }

  // use random 32 bytes as leaves
  const leaves = Array.from(
    { length: proofSize },
    () =>
      "0x3239aa7c79368121ae1a0e73b662a9fd8f0c7f6aa1a7dfdc2eebdbeb2f9b070c" as Hex
  )
  const proofPayload = concatHex([
    `0x${proofSize.toString(16).padStart(64, "0")}` as Hex,
    ...leaves
  ])

  return concatHex([
    prefix,
    mockModePayload,
    proofPayload,
    "0x0000000000000000000000000000000000000000000000000000000000000041", // length
    DUMMY_SIGNATURE
  ])
}
