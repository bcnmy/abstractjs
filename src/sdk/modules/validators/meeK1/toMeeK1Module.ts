import { zeroAddress } from "viem"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toMeeK1Module = (
  parameters: Omit<ValidatorParameters, "initData">
): Validator =>
  toValidator({
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    ...parameters,
    address: parameters.module,
    module: parameters.module,
    type: "validator",
    getStubSignature: async () => DUMMY_SIGNATURE
  })
