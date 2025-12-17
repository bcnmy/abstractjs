import type { Address, Hex, Prettify, SignableMessage } from "viem"
import { DUMMY_SIGNATURE } from ".."
// import type { Signer } from "../../account"
import type { WalletClient } from "viem"

export type GenericValidatorConfig<
  T extends ValidatorRequiredConfig = ValidatorRequiredConfig
> = T

export type ValidatorRequiredConfig = {
  /** The init data of the module. Alias for data. */
  initData: Hex
  /** The hexadecimal address of the module. */
  module: Address
  /** The eoa. */
  // signer: Signer
  walletClient: WalletClient
}

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
  // signTypedData: () => Promise<Hex>

  /**
                 * Signs a user operation hash.
                 * @param userOpHash - The user operation hash to sign.
                 // Review:
                 * @param params - Optional parameters for generating the signature.
                 * @returns A promise that resolves to a hexadecimal string representing the signature.
                 */
  signUserOpHash: (userOpHash: Hex) => Promise<Hex>
  /**
   * Gets the stub signature of the module.
   */
  getStubSignature: () => Promise<Hex>
  /**
   * Checks if the module supports EIP-7739.
   * @returns A promise that resolves to a boolean indicating whether the module supports EIP-7739.
   */
  erc7739VersionSupported: () => Promise<number>
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
    walletClient,
    data = "0x",
    module,
    erc7739VersionSupported_,
    ...rest
  } = parameters

  if (!walletClient.account) {
    throw new Error(
      "Account should be defined in the wallet client provided to the `toValidator`"
    )
  }

  let _erc7739VersionSupported: number | undefined = undefined

  const erc7739VersionSupported = async (): Promise<number> => {
    if (!_erc7739VersionSupported) {
      // const returnData =
      // TODO:  add actual call to the module to get the version supported
      _erc7739VersionSupported = 0
    }
    return _erc7739VersionSupported!
  }

  return {
    deInitData,
    data,
    module,
    address: module,
    walletClient,
    type,
    getStubSignature: async () => DUMMY_SIGNATURE,
    signUserOpHash: async (userOpHash: Hex) =>
      await walletClient.signMessage({
        account: walletClient.account!,
        message: { raw: userOpHash }
      }),
    signMessage: async (message: SignableMessage) =>
      await walletClient.signMessage({
        account: walletClient.account!,
        message
      }),
    erc7739VersionSupported,
    ...rest
  }
}
