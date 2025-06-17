import type { Address } from "viem/accounts"
import { addressEquals } from "../../../account/utils/Utils"
import type { BaseMeeClient } from "../../createMeeClient"
import { getGasToken } from "./getGasToken"

/**
 * Represents a payment token configuration with its properties and capabilities.
 * This interface defines the structure of tokens that can be used for gas payments.
 */
export interface PaymentToken {
  /**
   * Human-readable name of the token
   * @example "USD Coin"
   */
  name: string
  /**
   * Contract address of the token on the blockchain
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC on Ethereum
   */
  address: Address
  /**
   * Token symbol
   * @example "USDC"
   */
  symbol: string
  /**
   * Number of decimal places the token uses
   * @example 6 // USDC uses 6 decimals
   * @example 18 // Most ERC20 tokens use 18 decimals
   */
  decimals: number
  /**
   * Indicates whether the token supports ERC20Permit functionality
   * When true, gasless approvals are possible
   */
  permitEnabled: boolean
}

/**
 * Parameters for retrieving payment token information
 */
export type GetPaymentTokenParams = {
  /**
   * The blockchain chain ID to query
   * @example 1 // Ethereum Mainnet
   * @example 137 // Polygon
   */
  chainId: number
  /**
   * The address of the token to retrieve information for
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
   */
  tokenAddress: Address
}

/**
 * Response payload containing payment token information and arbitrary token support info
 */
export type GetPaymentTokenPayload = {
  isArbitraryPaymentTokensSupported: boolean
  paymentToken?: PaymentToken
}

/**
 * Retrieves detailed information about a specific payment token on a given chain.
 * This function validates if the token is supported for gas payments and returns its configuration.
 *
 * @param client - The Mee client instance
 * @param parameters - Query parameters for the token
 * @param parameters.chainId - The blockchain chain ID
 * @param parameters.tokenAddress - The token contract address to query
 *
 * @returns Promise resolving to the payment token configuration
 *
 * @example
 * ```typescript
 * const tokenInfo = await getPaymentToken(client, {
 *   chainId: 1,
 *   tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
 * });
 * // Returns:
 * // {
 * //   isArbitraryPaymentTokensSupported: true,
 * //   paymentToken: {
 * //     name: "USD Coin",
 * //     address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 * //     symbol: "USDC",
 * //     decimals: 6,
 * //     permitEnabled: true
 * //   }
 * // }
 * ```
 *
 * @throws Will throw an error if:
 * - The token is not supported on the specified chain
 * - The chain ID is not supported
 */
export const getPaymentToken = async (
  client: BaseMeeClient,
  parameters: GetPaymentTokenParams
): Promise<GetPaymentTokenPayload> => {
  const gasToken = await getGasToken(client, {
    chainId: parameters.chainId,
    address: parameters.tokenAddress
  })
  const paymentToken = gasToken.paymentTokens.find((paymentToken) =>
    addressEquals(paymentToken.address, parameters.tokenAddress)
  )
  return {
    isArbitraryPaymentTokensSupported:
      gasToken.isArbitraryPaymentTokensSupported,
    paymentToken
  }
}

export default getPaymentToken
