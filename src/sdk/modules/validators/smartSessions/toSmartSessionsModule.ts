import { getSmartSessionsValidator } from "@rhinestone/module-sdk"
import { type Validator, toValidator } from "../toValidator"
import type { WalletClient } from "viem"

export type SmartSessionsModuleParameters = {
  walletClient: WalletClient
}

export const toSmartSessionsModule = (
  parameters: SmartSessionsModuleParameters
): Validator => {
  const { walletClient } = parameters ?? {}

  return toValidator({
    ...getSmartSessionsValidator({ useRegistry: false }),
    walletClient,
    type: "validator"
  })
}
