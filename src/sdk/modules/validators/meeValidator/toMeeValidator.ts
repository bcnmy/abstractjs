import type { Hex } from "viem"
import { MEE_VALIDATOR_ADDRESS } from "../../../constants"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../smartSessions/toSmartSessionsModule"

export const toMeeValidator = (
  parameters: Omit<ValidatorParameters, "module" | "initData">
): Validator =>
  toValidator({
    ...parameters,
    address: MEE_VALIDATOR_ADDRESS,
    module: MEE_VALIDATOR_ADDRESS,
    type: "validator",
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    getStubSignature: async () => DUMMY_SIGNATURE,
    signUserOpHash: async (userOpHash: Hex) => {
      const signature = await parameters.signer.signMessage({
        message: { raw: userOpHash as Hex }
      })
      return signature
    }
  })
