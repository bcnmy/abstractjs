import type { Hex } from "viem"
import type { MinimalModuleConfig } from "../account"
import { COMPOSABLE_MODULE_ADDRESS } from "../constants"

export const toComposableFallback = (): MinimalModuleConfig => ({
  module: COMPOSABLE_MODULE_ADDRESS,
  data: "0xea5a6d9100" as Hex
})
