import type { Address } from "viem"
import type { MinimalModuleConfig } from "../account"

export const toComposableExecutor = (
  composableAddress: Address
): MinimalModuleConfig => ({
  module: composableAddress,
  data: "0x"
})
