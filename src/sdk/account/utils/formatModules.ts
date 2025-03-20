import type { Address, Hex } from "viem"

/**
 * Formats modules to ensure they have the correct structure for the contract
 * @param modules Array of modules to format
 * @returns Formatted modules with module and data properties
 */
export const formatModules = (
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  modules: any[]
): Array<{ module: Address; data: Hex }> =>
  modules.map((mod) => ({
    module: mod.module || mod.address,
    data: mod.initData || mod.data
  }))
