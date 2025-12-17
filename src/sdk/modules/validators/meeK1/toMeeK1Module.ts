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
  if (!parameters.walletClient.account) {
    throw new Error(
      "Account should be set in the wallet client provided to set the MeeK1 module"
    )
  }
  return toValidator({
    initData: parameters.walletClient.account.address,
    data: parameters.walletClient.account.address,
    deInitData: "0x",
    ...parameters,
    address: parameters.module,
    module: parameters.module,
    type: "validator",
    getStubSignature: async () =>
      getMeeK1ModuleStubSignature(signatureType, superTxEntriesCount)
  })
}
