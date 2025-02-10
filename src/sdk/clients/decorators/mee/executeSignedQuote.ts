import type { Hex } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"
import type { SignQuotePayload } from "./signQuote"

/**
 * Parameters for executing a signed quote
 */
export type ExecuteSignedQuoteParams = {
  /**
   * The signed quote payload to execute
   * @see {@link SignQuotePayload}
   */
  signedQuote: SignQuotePayload
}

/**
 * Response payload from executing a signed quote
 */
export type ExecuteSignedQuotePayload = {
  /**
   * The transaction hash of the executed supertransaction
   * This hash can be used with waitForSupertransactionReceipt
   * @example "0x123..."
   */
  hash: Hex
}

/**
 * Executes a previously signed quote through the MEE service.
 * This is the final step in the quote flow, where the transaction
 * is actually sent to the blockchain.
 *
 * @param client - The Mee client instance
 * @param parameters - Parameters for executing the signed quote
 * @param parameters.signedQuote - The signed quote from signQuote
 *
 * @returns Promise resolving to the transaction hash
 *
 * @example
 * ```typescript
 * const result = await executeSignedQuote(meeClient, {
 *   signedQuote: signedQuotePayload
 * });
 * // Returns:
 * // {
 * //   hash: "0x123..." // Supertransaction hash
 * // }
 *
 * // Can then wait for receipt:
 * const receipt = await waitForSupertransactionReceipt(meeClient, {
 *   hash: result.hash
 * });
 * ```
 *
 * @throws Will throw an error if:
 * - The signed quote format is invalid
 * - The execution fails
 * - The client doesn't have sufficient balance
 * - The signature is invalid
 */

export const executeSignedQuote = async (
  client: BaseMeeClient,
  params: ExecuteSignedQuoteParams
): Promise<ExecuteSignedQuotePayload> =>
  client.request<ExecuteSignedQuotePayload>({
    path: "v1/exec",
    body: params.signedQuote
  })

export default executeSignedQuote
