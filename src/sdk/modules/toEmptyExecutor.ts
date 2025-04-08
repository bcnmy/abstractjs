import { zeroAddress, zeroHash } from "viem"
import type { ModuleConfig } from "../account/decorators/getFactoryData"

export const toEmptyExecutor = (): ModuleConfig => ({
  module: zeroAddress,
  data: zeroHash
})
