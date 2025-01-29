import type { HttpClient } from "../../createHttpClient"

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
  supported_gas_tokens: SupportedGasToken[]
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
 * Represents supported gas tokens for a specific chain
 */
export interface SupportedGasToken {
  /** Chain identifier */
  chainId: string
  /** List of payment tokens accepted for gas fees */
  paymentTokens: PaymentToken[]
}

/**
 * Represents a payment token configuration
 */
export interface PaymentToken {
  /** Token name */
  name: string
  /** Token contract address */
  address: string
  /** Token symbol */
  symbol: string
  /** Number of decimal places for the token */
  decimals: number
  /** Whether permit functionality is enabled for this token */
  permitEnabled: boolean
}

/**
 * Represents a supported wallet provider configuration
 */
export interface SupportedWalletProvider {
  /** Wallet provider identifier */
  walletProvider: string
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
