import type { Hex } from "viem"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toLegacyK1Module = (
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
    getStubSignature: async () => {
      // just a random 130 bytes secp256k1 sig
      return "0x81d4b4981670cb18f99f0b4a66446df1bf5b204d24cfcb659bf38ba27a4359b5711649ec2423c5e1247245eba2964679b6a1dbb85c992ae40b9b00c6935b02ff1b" as Hex
    }
  })
