import { zeroAddress, zeroHash } from "viem"
import type { MinimalModuleConfig } from "../account"

export const toEmptyHook = (): MinimalModuleConfig => ({
  module: zeroAddress,
  data: zeroHash
})
