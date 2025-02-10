import type { BaseMeeClient } from "../../createMeeClient"
import {
  type ExecuteSignedQuotePayload,
  executeSignedQuote
} from "./executeSignedQuote"
import { type SignQuoteParams, signQuote } from "./signQuote"

/**
 * Executes a quote by signing it and then executing the signed quote.
 * This is a two-step process that:
 * 1. Signs the quote using {@link signQuote}
 * 2. Executes the signed quote using {@link executeSignedQuote}
 *
 * @param client - The Mee client instance used for API interactions
 * @param params - Parameters for signing the quote
 * @param params.quote - The quote object to be signed and executed
 * @param params.quote.id - Unique identifier of the quote
 * @param params.quote.chainId - Target blockchain chain ID
 * @param params.quote.instructions - Array of transaction instructions
 * @param params.quote.gasToken - Optional token address used for gas payment
 * @param params.quote.permitData - Optional permit data if using permit for gas token
 *
 * @returns Promise resolving to {@link ExecuteSignedQuotePayload} containing:
 * - hash: The transaction hash
 * - chainId: The chain ID where the transaction was executed
 * - status: The transaction status
 *
 * @example
 * ```typescript
 * const result = await executeQuote(client, {
 *   quote: {
 *     id: "quote_123",
 *     chainId: "1",
 *     instructions: [{
 *       to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *       data: "0x...",
 *       value: "0"
 *     }],
 *     gasToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *     expiresAt: "2024-03-21T15:00:00Z"
 *   }
 * });
 * // result: { hash: "0x...", chainId: "1", status: "pending" }
 * ```
 *
 * @throws Will throw an error if either the signing or execution step fails
 */
export const executeQuote = async (
  client: BaseMeeClient,
  params: SignQuoteParams
): Promise<ExecuteSignedQuotePayload> => {
  const signedQuote = await signQuote(client, params)
  return executeSignedQuote(client, { signedQuote })
}

export default executeQuote
