import type { Hex } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"
import executeSignedQuote from "./executeSignedQuote"
import signFusionQuote, {
  type SignFusionQuoteParameters
} from "./signFusionQuote"

/**
 * Parameters for executing a fusion quote
 * @see {@link SignFusionQuoteParameters}
 */
export type ExecuteFusionQuoteParams = SignFusionQuoteParameters

/**
 * Response payload from executing a fusion quote
 */
export type ExecuteFusionQuotePayload = {
  /**
   * The transaction hash of the executed supertransaction
   * This hash can be used with waitForSupertransactionReceipt
   * @example "0x123..."
   */
  hash: Hex
}

/**
 * Convenience method that combines signFusionQuote and executeSignedQuote into a single operation.
 * This function automatically handles the signing process (either permit or on-chain) and executes
 * the transaction in one step.
 *
 * @param client - The Mee client instance
 * @param parameters - Parameters for the fusion quote execution
 * @param parameters.fusionQuote - The fusion quote to execute
 * @param [parameters.account] - Optional account to use for signing
 *
 * @returns Promise resolving to the transaction hash
 *
 * @example
 * ```typescript
 * const result = await executeFusionQuote(meeClient, {
 *   fusionQuote: {
 *     quote: quotePayload,
 *     trigger: {
 *       tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *       chainId: 1,
 *       amount: "1000000" // 1 USDC
 *     }
 *   },
 *   account: smartAccount // Optional
 * });
 * // Returns:
 * // {
 * //   hash: "0x123..." // Supertransaction hash
 * // }
 * ```
 *
 * @throws Will throw an error if:
 * - The quote format is invalid
 * - The signing process fails
 * - The execution fails
 * - The token information cannot be retrieved
 */
export const executeFusionQuote = async (
  client: BaseMeeClient,
  parameters: ExecuteFusionQuoteParams
): Promise<ExecuteFusionQuotePayload> => {
  const signedFusionQuote = await signFusionQuote(client, parameters)
  return executeSignedQuote(client, { signedQuote: signedFusionQuote })
}

export default executeFusionQuote
