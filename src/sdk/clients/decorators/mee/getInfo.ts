import type { HttpClient } from "../../createHttpClient"
import type { GetGasTokenPayload } from "./getGasToken"
import type { WalletProvider } from "./getQuote"

/**
 * Response payload for the getInfo endpoint
 */
export type GetInfoPayload = {
  /**
   * Version of the MEE API
   * @example "1.0.0"
   */
  version: string
  /**
   * Node information string
   * @example "mee-node-1"
   */
  node: string
  /**
   * List of supported blockchain chains
   */
  supportedChains: SupportedChain[]
  /**
   * List of supported gas tokens per chain
   * @see {@link GetGasTokenPayload}
   */
  supportedGasTokens: GetGasTokenPayload[]
  /**
   * List of supported wallet providers and their capabilities
   */
  supported_wallet_providers: SupportedWalletProvider[]
}

/**
 * Represents a supported blockchain chain
 */
export interface SupportedChain {
  /**
   * Chain identifier
   * @example "1" // Ethereum Mainnet
   * @example "137" // Polygon
   */
  chainId: string
  /**
   * Human-readable chain name
   * @example "Ethereum Mainnet"
   * @example "Polygon"
   */
  name: string
}

/**
 * Represents a supported wallet provider configuration
 */
export interface SupportedWalletProvider {
  /**
   * Wallet provider identifier
   * @see {@link WalletProvider}
   * @example "SAFE_V141"
   */
  walletProvider: WalletProvider
  /**
   * List of chain IDs supported by this wallet provider
   * @example ["1", "137"] // Provider supports Ethereum and Polygon
   */
  supportedChains: string[]
  /**
   * Whether EOA (Externally Owned Account) is enabled for this provider
   */
  eoaEnabled?: boolean
  /**
   * Whether EOA fusion is supported by this provider
   */
  eoaFusion?: boolean
}

/**
 * Retrieves information about supported chains, tokens, and wallet providers from the MEE service.
 * This endpoint provides configuration details needed to interact with the service.
 *
 * @param client - The HTTP client instance
 * @returns Promise resolving to the info payload
 *
 * @example
 * ```typescript
 * const info = await getInfo(httpClient);
 * // Returns:
 * // {
 * //   version: "1.0.0",
 * //   node: "mee-node-1",
 * //   supportedChains: [
 * //     { chainId: "1", name: "Ethereum Mainnet" },
 * //     { chainId: "137", name: "Polygon" }
 * //   ],
 * //   supportedGasTokens: [...],
 * //   supported_wallet_providers: [
 * //     {
 * //       walletProvider: "SAFE_V141",
 * //       supportedChains: ["1", "137"],
 * //       eoaEnabled: true
 * //     }
 * //   ]
 * // }
 * ```
 */
export const getInfo = async (client: HttpClient): Promise<GetInfoPayload> =>
  client.request<GetInfoPayload>({
    path: "info",
    method: "GET"
  })

export default getInfo
