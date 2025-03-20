import type { Address, Hex } from "viem"
import type { GenericModuleConfig } from "../toNexusAccount"
/**
 * Formats modules to ensure they have the correct structure for the contract
 * @param modules Array of modules to format
 * @returns Formatted modules with module and data properties
 */
export const formatModules = (
  modules: Array<
    GenericModuleConfig | { module: Address; data?: Hex; initData?: Hex }
  >
): Array<{ module: Address; data: Hex }> =>
  modules.map((mod) => ({
    module: mod.module,
    data: mod.data || mod.initData || "0x"
  }))
