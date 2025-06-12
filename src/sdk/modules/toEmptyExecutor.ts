import { zeroAddress, zeroHash } from "viem"
import type { MinimalModuleConfig } from "../account"

export const toEmptyExecutor = (): MinimalModuleConfig => ({
  module: zeroAddress,
  data: zeroHash
})
