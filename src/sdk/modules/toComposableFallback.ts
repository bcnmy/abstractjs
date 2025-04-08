import type { Hex } from "viem"
import type { ModuleConfig } from "../account/decorators/getFactoryData"
import { COMPOSABLE_MODULE_ADDRESS } from "../constants"

export const toComposableFallback = (): ModuleConfig => ({
  module: COMPOSABLE_MODULE_ADDRESS,
  data: "0xea5a6d9100" as Hex
})
