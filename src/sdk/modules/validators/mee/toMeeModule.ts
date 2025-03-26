import { MEE_VALIDATOR_ADDRESS } from "../../../constants"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toMeeModule = (
  parameters: Omit<ValidatorParameters, "module" | "initData">
): Validator =>
  toValidator({
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    ...parameters,
    address: MEE_VALIDATOR_ADDRESS,
    module: MEE_VALIDATOR_ADDRESS,
    type: "validator",
    getStubSignature: async () => DUMMY_SIGNATURE
  })
