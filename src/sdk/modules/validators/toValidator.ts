import type { Address, Hex, Prettify, SignableMessage } from "viem"
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
  /** The eoa. */
  signer: Signer
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
}

export type Validator = Prettify<
  GenericValidatorConfig & ValidatorOptionalConfig & ValidatorActions
>
export type ValidatorParameters = Prettify<
  GenericValidatorConfig & Partial<ValidatorOptionalConfig & ValidatorActions>
>

export const toValidator = (parameters: ValidatorParameters): Validator => {
  const {
    deInitData = "0x",
    type = "validator",
    signer,
    data = "0x",
    module,
    ...rest
  } = parameters

  return {
    deInitData,
    data,
    module,
    address: module,
    signer,
    type,
    getStubSignature: async () => DUMMY_SIGNATURE,
    signUserOpHash: async (userOpHash: Hex) =>
      await signer.signMessage({ message: { raw: userOpHash } }),
    signMessage: async (message: SignableMessage) =>
      await signer.signMessage({ message }),
    ...rest
  }
}
