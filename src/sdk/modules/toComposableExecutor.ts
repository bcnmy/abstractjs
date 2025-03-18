import { zeroHash } from "viem"
import type { ModuleConfig } from "../account/decorators/getFactoryData"
import { LATEST_DEFAULT_ADDRESSES } from "../constants"

export const toComposableExecutor = (): ModuleConfig => ({
  module: LATEST_DEFAULT_ADDRESSES.executorAddress,
  data: zeroHash
})
