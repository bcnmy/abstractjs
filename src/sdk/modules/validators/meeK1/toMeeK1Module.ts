import {
  type MeeSignatureType,
  getMeeK1ModuleStubSignature
} from "../default/toDefaultModule"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toMeeK1Module = (
  parameters: Omit<ValidatorParameters, "initData"> & {
    signatureType?: MeeSignatureType
    superTxEntriesCount?: number
  }
): Validator => {
  const { signatureType = "simple", superTxEntriesCount = 3 } = parameters
  return toValidator({
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    ...parameters,
    address: parameters.module,
    module: parameters.module,
    type: "validator",
    getStubSignature: async () =>
      getMeeK1ModuleStubSignature(signatureType, superTxEntriesCount)
  })
}
