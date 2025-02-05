import type { HttpClient } from "../../createHttpClient"
import type { GetGasTokenPayload } from "./getGasToken"
import type { WalletProvider } from "./getQuote"

/**
 * Response payload for the getInfo endpoint
 */
export type GetInfoPayload = {
  /** Version of the API */
  version: string
  /** Node information */
  node: string
  /** List of supported blockchain chains */
  supported_chains: SupportedChain[]
  /** List of supported gas tokens per chain */
  supported_gas_tokens: GetGasTokenPayload[]
  /** List of supported wallet providers */
  supported_wallet_providers: SupportedWalletProvider[]
}

/**
 * Represents a supported blockchain chain
 */
export interface SupportedChain {
  /** Chain identifier */
  chainId: string
  /** Human-readable chain name */
  name: string
}

/**
 * Represents a supported wallet provider configuration
 */
export interface SupportedWalletProvider {
  /** Wallet provider identifier */
  walletProvider: WalletProvider
  /** List of chain IDs supported by this wallet provider */
  supportedChains: string[]
  /** Whether EOA (Externally Owned Account) is enabled */
  eoaEnabled?: boolean
  /** Whether EOA fusion is supported */
  eoaFusion?: boolean
}

/**
 * Retrieves information about supported chains, tokens, and wallet providers
 * @param client - HTTP client instance
 * @returns Promise resolving to the info payload
 */
export const getInfo = async (client: HttpClient): Promise<GetInfoPayload> =>
  client.request<GetInfoPayload>({
    path: "info",
    method: "GET"
  })

export default getInfo
