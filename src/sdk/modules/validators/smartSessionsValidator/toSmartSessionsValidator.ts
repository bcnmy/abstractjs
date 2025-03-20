import type { Hex } from "viem"
import type { Signer } from "../../../account/utils/toSigner"
import {
  SmartSessionMode,
  encodeSmartSessionSignature,
  getOwnableValidatorMockSignature,
  getSmartSessionsValidator
} from "../../../constants"
import { toValidator } from "../../validators/toValidator"
import type { Validator } from "../types"
import type { UsePermissionModuleData } from "./Types"

export const DUMMY_ECDSA_SIG =
  "0xe8b94748580ca0b4993c9a1b86b5be851bfc076ff5ce3a1ff65bf16392acfcb800f9b4f1aef1555c7fce5599fffb17e7c635502154a0333ba21f3ae491839af51c"

export type SmartSessionValidatorParameters = UsePermissionModuleData & {
  signer: Signer
}
export const toSmartSessionsValidator = (
  parameters: SmartSessionValidatorParameters
): Validator => {
  const {
    signer,
    permissionIdIndex = 0,
    permissionIds = [],
    mode = SmartSessionMode.USE,
    enableSessionData
  } = parameters

  return toValidator({
    ...parameters,
    ...getSmartSessionsValidator({ useRegistry: false }),
    type: "validator",
    signer,
    data: "0x",
    deInitData: "0x",
    getStubSignature: async () =>
      encodeSmartSessionSignature({
        mode,
        permissionId: permissionIds[permissionIdIndex],
        enableSessionData,
        signature: getOwnableValidatorMockSignature({
          threshold: 1
        })
      }),
    signUserOpHash: async (userOpHash: Hex) =>
      encodeSmartSessionSignature({
        mode,
        permissionId: permissionIds[permissionIdIndex],
        enableSessionData,
        signature: await signer.signMessage({
          message: { raw: userOpHash as Hex }
        })
      })
  })
}
