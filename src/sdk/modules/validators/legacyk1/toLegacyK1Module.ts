import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toLegacyK1Module = (
  parameters: Omit<ValidatorParameters, "initData" >
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
      const dynamicPart = parameters.module.substring(2).padEnd(40, "0")
      return `0x0000000000000000000000000000000000000000000000000000000000000040000000000000000000000000${dynamicPart}000000000000000000000000000000000000000000000000000000000000004181d4b4981670cb18f99f0b4a66446df1bf5b204d24cfcb659bf38ba27a4359b5711649ec2423c5e1247245eba2964679b6a1dbb85c992ae40b9b00c6935b02ff1b00000000000000000000000000000000000000000000000000000000000000` as Hex
    },
  })
