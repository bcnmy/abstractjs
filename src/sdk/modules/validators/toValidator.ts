import type { Address, Hex, OneOf, Prettify, SignableMessage, TypedDataDefinition, WalletClient } from "viem"
import { DUMMY_SIGNATURE } from ".."
import type { Signer } from "../../account"

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
  erc7739VersionSupported: () => Promise<number>,
  /**
   * 
   * Signs a message as per EIP-7739 PersonalSign flow.
   * @param message - The message to sign.
   * @returns A promise that resolves to a hexadecimal string representing the signature.
   */
  signMessageErc7739: (message: SignableMessage) => Promise<Hex>
  /**
   * Signs typed data as per EIP-7739 TypedDataSign flow
   * @returns A promise that resolves to a hexadecimal string representing the signature.
   **/
  signTypedDataErc7739: (typedData: TypedDataDefinition) => Promise<Hex>
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
    throw new Error("Account should be defined in the wallet client provided to the `toValidator`")
  }

  let _erc7739VersionSupported: number | undefined = erc7739VersionSupported_

  const erc7739VersionSupported = async (): Promise<number> => {
    if (!_erc7739VersionSupported) {
      // const returnData =
      // TODO:  add actual call to the module to get the version supported
      _erc7739VersionSupported = 0
    }
    return _erc7739VersionSupported!
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

  const signTypedData = async (typedData: TypedDataDefinition): Promise<Hex> => {
    if (signer) {
      return await signer.signTypedData(typedData)
    }
    return await walletClient!.signTypedData({
      account: walletClient!.account!,
      ...typedData
    })
  }

  const signMessageErc7739 = () => {
    throw new Error("Erc7739 PersonalSign flow is not supported by this module")
  }

  const signTypedDataErc7739 = () => {
    throw new Error("Erc7739 TypedDataSign flow is not supported by this module")
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
