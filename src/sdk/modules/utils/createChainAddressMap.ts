import type { Address } from "viem"
import type { AnyData } from "./Types"

/**
 * Creates a type-safe mapping from chain IDs to addresses with runtime safety utilities
 * @param entries - Array of tuples containing [chainId, address]
 * @returns An object mapping chain IDs to addresses with type safety and utility methods
 */
export function createChainAddressMap<
  T extends readonly (readonly [number, Address])[]
>(
  entries: T
): {
  readonly [K in T[number][0]]: Extract<T[number], readonly [K, AnyData]>[1]
} & {
  get(chainId: number): Address | undefined
  has(chainId: number): boolean
} {
  const map = {} as AnyData

  for (const [chainId, address] of entries) {
    map[chainId] = address
  }

  // Add utility methods
  map.get = (chainId: number): Address | undefined => map[chainId]
  map.has = (chainId: number): boolean => chainId in map

  return map
}
