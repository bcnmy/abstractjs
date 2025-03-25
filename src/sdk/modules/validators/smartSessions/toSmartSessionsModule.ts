import {
  SmartSessionMode,
  encodeSmartSessionSignature,
  getOwnableValidatorMockSignature,
  getSmartSessionsValidator
} from "@rhinestone/module-sdk"
import type { Address, Hex, Prettify, SignableMessage } from "viem"
import type { Signer } from "../../../account/utils/toSigner"
import { sanitizeSignature } from "../../utils/Helpers"
import { DUMMY_SIGNATURE } from "./Helpers"
import type { UsePermissionModuleData } from "./Types"

export type SmartSessionsValidatorParameters = {
  moduleData?: UsePermissionModuleData
  signer: Signer
}

export const toSmartSessionsValidator = (
  parameters: SmartSessionsValidatorParameters
): Validator => {
  const { moduleData, signer } = parameters ?? {}

  return toValidator({
    ...getSmartSessionsValidator({ useRegistry: false }),
    signer,
    type: "validator",
    getStubSignature: async () => {
      if (!moduleData) {
        console.log("returning dummy signature", DUMMY_SIGNATURE)
        return DUMMY_SIGNATURE
      }
      const {
        permissionIds = [],
        permissionIdIndex = 0,
        enableSessionData,
        mode = SmartSessionMode.USE
      } = moduleData
      return encodeSmartSessionSignature({
        mode,
        permissionId: permissionIds[permissionIdIndex],
        enableSessionData,
        signature: getOwnableValidatorMockSignature({ threshold: 1 })
      })
    },
    signUserOpHash: async (userOpHash: Hex) => {
      console.log("toSmartSessionsValidator signUserOpHash", { moduleData })
      const signature = await signer.signMessage({
        message: { raw: userOpHash }
      })
      if (!moduleData) {
        return signature
      }
      const {
        permissionIds = [],
        permissionIdIndex = 0,
        enableSessionData,
        mode = SmartSessionMode.USE
      } = moduleData
      return encodeSmartSessionSignature({
        mode,
        permissionId: permissionIds[permissionIdIndex],
        enableSessionData,
        signature
      })
    }
  })
}

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
      sanitizeSignature(await signer.signMessage({ message })),
    ...rest
  }
}
