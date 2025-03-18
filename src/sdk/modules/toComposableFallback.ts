import type { Hex } from "viem"
import type { ModuleConfig } from "../account/decorators/getFactoryData"
import { LATEST_DEFAULT_ADDRESSES } from "../constants"

export const toComposableFallback = (): ModuleConfig => ({
  module: LATEST_DEFAULT_ADDRESSES.executorAddress,
  data: "0x7192a24800" as Hex
})
