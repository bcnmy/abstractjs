import type { Address } from "viem"
import { addressEquals } from "../../../account/utils/Utils"
import type { HttpClient } from "../../createHttpClient"
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
  address: Address
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

type GetGasTokenByChainIdParams = {
  /** The info payload to use */
  info: GetInfoPayload
  /** The chainId to use */
  targetChainId: number
}
/**
 * @internal
 */
export const getGasTokenByChainId = ({
  info,
  targetChainId
}: GetGasTokenByChainIdParams) => {
  const gasToken = info.supported_gas_tokens.find(
    (gasToken) => Number(gasToken.chainId) === targetChainId
  )
  if (!gasToken) {
    throw new Error(`Gas token not found for chain ${targetChainId}`)
  }
  return gasToken
}
type GetPaymentTokenByChainIdParams = {
  /** The info payload to use */
  info: GetInfoPayload
  targetTokenData: {
    /** The chainId to use */
    chainId: number
    /** The address of the payment token to use */
    address: Address
  }
}
/**
 * @internal
 */
export const getPaymentTokenByChainId = ({
  info,
  targetTokenData: { chainId, address }
}: GetPaymentTokenByChainIdParams): PaymentToken => {
  const gasToken = getGasTokenByChainId({ info, targetChainId: chainId })
  const paymentToken = gasToken.paymentTokens.find((paymentToken) =>
    addressEquals(paymentToken.address, address)
  )
  if (!paymentToken) {
    throw new Error(
      `Payment token not found for chain ${chainId} and address ${address}`
    )
  }
  return paymentToken
}

export default getInfo
