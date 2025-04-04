import type { ModuleConfig } from "../account/decorators/getFactoryData"
import { COMPOSABLE_MODULE_ADDRESS } from "../constants"

export const toComposableExecutor = (): ModuleConfig => ({
  module: COMPOSABLE_MODULE_ADDRESS,
  data: "0x"
})
