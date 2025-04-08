import { zeroAddress } from "viem"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toDefaultModule = (
  parameters: Omit<ValidatorParameters, "module" | "initData">
): Validator =>
  toValidator({
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    ...parameters,
    address: zeroAddress,
    module: zeroAddress,
    type: "validator",
    getStubSignature: async () => DUMMY_SIGNATURE
  })
