import type { Hex } from "viem"
import type { ModuleMeta, ModuleParameters } from "../utils/Types"
import { toModule } from "../utils/toModule"

export const COMPOSABILITY_MODULE_ADDRESS: Hex =
  "0xab67521a70271bF625cE508F70c8cAeFe68dDc65"

export const toComposabilityFallback = (
  module: Omit<ModuleParameters, "address">
) => {
  const moduleInitData: ModuleMeta = {
    address: COMPOSABILITY_MODULE_ADDRESS,
    type: "fallback",
    initData: "0x"
  }

  return toModule({
    moduleInitData,
    ...module,
    address: COMPOSABILITY_MODULE_ADDRESS,
    type: "fallback"
  })
}
