import type { Address } from "viem/accounts"
import type { BaseMeeClient } from "../../createMeeClient"
import type { SupportedFeeToken } from "./getSupportedFeeToken"

/**
 * Parameters for retrieving gas token information
 */
export type GetGasTokenParams = {
  /**
   * The blockchain chain ID to query
   * @example 1 // Ethereum Mainnet
   * @example 137 // Polygon
   */
  chainId: number
  /**
   * The address of the payment token to validate
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC on Ethereum
   */
  address: Address
}

/**
 * Response payload containing gas token information for a specific chain
 */
export type GetGasTokenPayload = {
  /**
   * Chain identifier as a string
   * @example "1" // Ethereum Mainnet
   */
  chainId: string
  /**
   * List of payment tokens that can be used for gas fees on this chain
   * @see {@link SupportedFeeToken} for detailed token structure
   */
  paymentTokens: SupportedFeeToken[]
  /**
   * This indicates that the network supports Arbitrary token payments as a fallback mechanism
   */
  isArbitraryFeeTokensSupported: boolean
}

/**
 * Retrieves information about supported gas tokens for a specific chain.
 * This function validates if a given token address is supported for gas payments
 * on the specified chain.
 *
 * @param client - The Mee client instance used for API interactions
 * @param parameters - Parameters for the gas token query
 * @param parameters.chainId - The blockchain chain ID to query
 * @param parameters.address - The address of the payment token to validate
 *
 * @returns Promise resolving to {@link GetGasTokenPayload} containing:
 * - chainId: The chain identifier
 * - paymentTokens: Array of supported payment tokens for gas fees
 *
 * @example
 * ```typescript
 * const gasTokenInfo = await getGasToken(client, {
 *   chainId: 1, // Ethereum Mainnet
 *   address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
 * });
 * // Returns:
 * // {
 * //   chainId: "1",
 * //   paymentTokens: [{
 * //     name: "USD Coin",
 * //     address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 * //     symbol: "USDC",
 * //     decimals: 6,
 * //     permitEnabled: true
 * //   }, ...]
 * // }
 * ```
 *
 * @throws Will throw an error if:
 * - The specified chain ID is not supported
 * - No gas tokens are found for the specified chain
 */
export const getGasToken = async (
  client: BaseMeeClient,
  parameters: GetGasTokenParams
): Promise<GetGasTokenPayload> => {
  const gasToken = client.info.supportedGasTokens.find(
    (gasToken) => Number(gasToken.chainId) === Number(parameters.chainId)
  )
  if (!gasToken) {
    throw new Error(`Gas token not found for chain ${parameters.chainId}`)
  }
  return gasToken
}

export default getGasToken
