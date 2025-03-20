import type { Hex, SignableMessage } from "viem"
import { sanitizeSignature } from "../../modules/utils/Helpers.js"
import { DUMMY_SIGNATURE } from "./k1Validator/toK1Validator"
import type { ValidatorParameters } from "./types"
import type { Validator } from "./types"

export function toValidator(parameters: ValidatorParameters): Validator {
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
    initData: data,
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
