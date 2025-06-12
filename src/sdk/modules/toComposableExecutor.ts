import type { MinimalModuleConfig } from "../account"
import { COMPOSABLE_MODULE_ADDRESS } from "../constants"

export const toComposableExecutor = (): MinimalModuleConfig => ({
  module: COMPOSABLE_MODULE_ADDRESS,
  data: "0x"
})
