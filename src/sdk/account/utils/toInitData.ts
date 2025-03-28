import type { Address, Hex } from "viem"
import type { AnyData } from "../../modules"

/**
 * Formats modules to ensure they have the correct structure for the contract
 * @param modules Array of modules to format
 * @returns Formatted modules with module and data properties
 */
export const toInitData = (mod: AnyData): { module: Address; data: Hex } => {
  const module = mod.module || mod.address
  const data = mod.initData || mod.data
  if (!module || !data) {
    throw new Error("Module or data is missing")
  }
  return { module, data }
}
