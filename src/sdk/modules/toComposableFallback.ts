import type { Hex } from "viem"
import type { ModuleConfig } from "../account/decorators/getFactoryData"
import { LATEST_DEFAULT_ADDRESSES } from "../constants"

export const toComposableFallback = (): ModuleConfig => ({
  module: LATEST_DEFAULT_ADDRESSES.executorAddress,
  data: "0xea5a6d9100" as Hex
})
