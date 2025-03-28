import type { AnyData, ModuleMeta } from "../../modules"

/**
 * Formats modules to ensure they have the correct structure for the contract
 * @param modules Array of modules to format
 * @returns Formatted modules with module and data properties
 */
export const toInstallData = (mod: AnyData): ModuleMeta => {
  const address = mod.module || mod.address
  const initData = mod.initData || mod.data
  const deInitData = mod.deInitData || "0x"
  const type = mod.type || mod.moduleType
  if (!address || !initData || !type) {
    throw new Error("address, type or data is missing")
  }
  return { address, initData, type, deInitData }
}
