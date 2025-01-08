import { getChain } from "@biconomy/sdk"
import type { Chain, Hex } from "viem"

const MEE_EXPLORER_URL = "https://meescan.biconomy.io/details/"

/**
 * Get the explorer tx link
 * @param hash - The transaction hash
 * @param chain - The chain
 * @returns The explorer tx link
 *
 * @example
 * ```ts
 * const hash = "0x123"
 * const chain = optimism
 * const url = getExplorerTxLink(hash, chain)
 * console.log(url) // https://meescan.biconomy.io/details/0x123
 * ```
 */
export const getExplorerTxLink = (
  hash: Hex,
  chain_?: Chain | number | string
) => {
  let chain: Chain | undefined
  if (chain_) {
    chain =
      typeof chain_ === "number" || typeof chain_ === "string"
        ? getChain(Number(chain_))
        : chain_
  }

  const explorer = chain
    ? `${chain.blockExplorers?.default.url}/tx/`
    : MEE_EXPLORER_URL
  return `${explorer}${hash}`
}
