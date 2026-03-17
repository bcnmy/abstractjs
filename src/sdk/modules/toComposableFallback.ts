import type { Address, Hex } from "viem"
import type { MinimalModuleConfig } from "../account"

export const toComposableFallback = (
  composableAddress: Address
): MinimalModuleConfig => ({
  module: composableAddress,
  data: "0xea5a6d9100" as Hex
})
