import { getSmartSessionsValidator } from "@rhinestone/module-sdk"
import { type Validator, toValidator } from "../toValidator"
import type { Signer } from "../../../account/utils/toSigner"

export type SmartSessionsModuleParameters = {
  signer: Signer
}

export const toSmartSessionsModule = (
  parameters: SmartSessionsModuleParameters
): Validator => {
  const { signer } = parameters ?? {}

  return toValidator({
    ...getSmartSessionsValidator({ useRegistry: false }),
    signer,
    type: "validator",
    erc7739VersionSupported_: 0 // doesn't support EIP-7739 by itself. sessionValidator can support it.
  })
}
