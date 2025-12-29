import {
  type Address,
  type Hex,
  type OneOf,
  type Prettify,
  type SignableMessage,
  type TypedDataDefinition,
  type TypedDataDomain,
  type WalletClient,
  parseAbi,
  publicActions
} from "viem"
import { DUMMY_SIGNATURE } from ".."
import type { Signer } from "../../account"

/**
 * ERC-7739 support detection constants
 * @see https://eips.ethereum.org/EIPS/eip-7739#support-detection
 */
const ERC7739_DETECTION_HASH: Hex =
  "0x7739773977397739773977397739773977397739773977397739773977397739"
const ERC7739_MAGIC_PREFIX = "0x77390" // bytes4(0x7739000x) where x is version

export type GenericValidatorConfig<
  T extends ValidatorRequiredConfig = ValidatorRequiredConfig
> = T

export type ValidatorRequiredConfig = {
  /** The init data of the module. Alias for data. */
  initData: Hex
  /** The hexadecimal address of the module. */
  module: Address
} & OneOf<
  | { /** The signer. */ signer: Signer }
  | { /** The wallet client. */ walletClient: WalletClient }
>

export type ValidatorOptionalConfig = {
  /** The type of the module. */
  type: "validator"
  /** The deinit data of the module. */
  deInitData: Hex
  /** The address of the module. Alias for module. */
  address: Address
  /** The init data of the module. Alias for initData. */
  data: Hex
}

export type ValidatorActions = {
  /**
   * Signs a message.
   * @param message - The message to sign, either as a Uint8Array or string.
   * @returns A promise that resolves to a hexadecimal string representing the signature.
   */
  signMessage: (message: SignableMessage) => Promise<Hex>
  /**
   * Signs a typed data.
   * @param typedData - The typed data to sign.
   * @returns A promise that resolves to a hexadecimal string representing the signature.
   */
  signTypedData: (typedData: TypedDataDefinition) => Promise<Hex>
  /**
   * Gets the stub signature of the module.
   */
  getStubSignature: () => Promise<Hex>
  /**
   * Checks if the module supports EIP-7739.
   * @returns A promise that resolves to a boolean indicating whether the module supports EIP-7739.
   */
  erc7739VersionSupported: () => Promise<number>
  /**
   *
   * Signs a message as per EIP-7739 PersonalSign flow.
   * @param message - The message to sign.
   * @param verifierDomain - The EIP-712 domain of the verifier (smart account) for ERC-7739.
   * @returns A promise that resolves to a hexadecimal string representing the signature.
   */
  signMessageErc7739: (
    message: SignableMessage,
    verifierDomain: TypedDataDomain
  ) => Promise<Hex>
  /**
   * Signs typed data as per EIP-7739 TypedDataSign flow
   * @param typedData - The typed data to sign.
   * @param verifierDomain - The EIP-712 domain of the verifier (smart account) for ERC-7739.
   * @returns A promise that resolves to a hexadecimal string representing the signature.
   **/
  signTypedDataErc7739: (
    typedData: TypedDataDefinition,
    verifierDomain: TypedDataDomain
  ) => Promise<Hex>
}

export type Validator = Prettify<
  GenericValidatorConfig & ValidatorOptionalConfig & ValidatorActions
>
export type ValidatorParameters = Prettify<
  GenericValidatorConfig &
    Partial<ValidatorOptionalConfig & ValidatorActions> & {
      erc7739VersionSupported_?: number
    }
>

export const toValidator = (parameters: ValidatorParameters): Validator => {
  const {
    deInitData = "0x",
    type = "validator",
    signer,
    walletClient,
    data = "0x",
    module,
    erc7739VersionSupported_,
    ...rest
  } = parameters

  if (walletClient && !walletClient.account) {
    throw new Error(
      "Account should be defined in the wallet client provided to the `toValidator`"
    )
  }

  let _erc7739VersionSupported: number | undefined = erc7739VersionSupported_

  const erc7739VersionSupported = async (): Promise<number> => {
    if (_erc7739VersionSupported === undefined) {
      // If walletClient is available, detect ERC-7739 version from contract
      if (walletClient) {
        _erc7739VersionSupported = await detectErc7739Version(
          walletClient,
          module
        )
      } else {
        // No walletClient available, can not detect ERC-7739 support
        // assume no ERC-7739 support
        _erc7739VersionSupported = 0
      }
    }
    return _erc7739VersionSupported
  }

  const signMessage = async (message: SignableMessage): Promise<Hex> => {
    if (signer) {
      return await signer.signMessage({ message })
    }
    return await walletClient!.signMessage({
      account: walletClient!.account!,
      message
    })
  }

  const signTypedData = async (
    typedData: TypedDataDefinition
  ): Promise<Hex> => {
    if (signer) {
      return await signer.signTypedData(typedData)
    }
    return await walletClient!.signTypedData({
      account: walletClient!.account!,
      ...typedData
    })
  }

  const signMessageErc7739 = (
    _message: SignableMessage,
    _verifierDomain: TypedDataDomain
  ) => {
    throw new Error("Erc7739 PersonalSign flow is not supported by this module")
  }

  const signTypedDataErc7739 = (
    _typedData: TypedDataDefinition,
    _verifierDomain: TypedDataDomain
  ): Promise<Hex> => {
    throw new Error(
      "Erc7739 TypedDataSign flow is not supported by this module"
    )
  }

  return {
    deInitData,
    data,
    module,
    address: module,
    ...(signer ? { signer } : { walletClient: walletClient! }),
    type,
    getStubSignature: async () => DUMMY_SIGNATURE,
    signMessage,
    signTypedData,
    erc7739VersionSupported,
    signMessageErc7739,
    signTypedDataErc7739,
    ...rest
  }
}

/**
 * Detects ERC-7739 version support by calling isValidSignature on the module contract
 * @param walletClient - The wallet client to use for the read call
 * @param moduleAddress - The address of the module contract
 * @returns The ERC-7739 version number (0 if not supported)
 */
const detectErc7739Version = async (
  walletClient: WalletClient,
  moduleAddress: Address
): Promise<number> => {
  try {
    const client = walletClient.extend(publicActions)
    const result = await client.readContract({
      address: moduleAddress,
      abi: parseAbi([
        "function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4)"
      ]),
      functionName: "isValidSignature",
      args: [ERC7739_DETECTION_HASH, "0x"]
    })

    // Check if result matches magic prefix 0x77390xxx
    if (
      typeof result === "string" &&
      result.toLowerCase().startsWith(ERC7739_MAGIC_PREFIX)
    ) {
      // Extract version from last digit (e.g., 0x77390001 -> version 1)
      const versionHex = result.slice(-1)
      return Number.parseInt(versionHex, 16)
    }
    return 0
  } catch {
    // If the call fails, module doesn't support ERC-7739
    return 0
  }
}
