import type { BaseMeeClient } from "../../createMeeClient"
import {
  type ExecuteSignedQuotePayload,
  executeSignedQuote
} from "./executeSignedQuote"
import getQuote, { type GetQuoteParams } from "./getQuote"
import { signQuote } from "./signQuote"

/**
 * Executes a quote by performing a three-step process:
 * 1. Fetches a quote using {@link getQuote}
 * 2. Signs the quote using {@link signQuote}
 * 3. Executes the signed quote using {@link executeSignedQuote}
 *
 * This is a convenience function that combines all three steps into a single operation.
 *
 * @param client - The Mee client instance used for API interactions
 * @param params - Parameters for generating the quote
 * @param params.instructions - Array of transaction instructions to be executed
 * @param params.chainId - Target blockchain chain ID
 * @param params.walletProvider - Wallet provider to use (e.g., "metamask", "walletconnect")
 * @param [params.gasToken] - Optional token address to use for gas payment
 * @param [params.permitData] - Optional permit data if using permit for gas token
 *
 * @returns Promise resolving to the execution payload containing transaction details
 *
 * @example
 * ```typescript
 * const hash = await execute(client, {
 *   chainId: "1", // Ethereum mainnet
 *   walletProvider: "metamask",
 *   instructions: [{
 *     to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *     data: "0x...", // Transaction data
 *     value: "0" // Amount in wei
 *   }],
 *   gasToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // Optional: USDC address
 * });
 * ```
 *
 * @throws Will throw an error if any of the three steps (get, sign, or execute) fail
 */
export const execute = async (
  client: BaseMeeClient,
  params: GetQuoteParams
): Promise<ExecuteSignedQuotePayload> => {
  const quote = await getQuote(client, params)
  const signedQuote = await signQuote(client, { quote })
  return executeSignedQuote(client, { signedQuote })
}

export default execute
