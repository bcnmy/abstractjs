import type { BaseMeeClient } from "../createMeeClient"
import { signQuote, type SignQuoteParams } from "./signQuote"
import {
  executeSignedQuote,
  type ExecuteSignedQuotePayload
} from "./executeSignedQuote"
import getQuote, { type GetQuoteParams } from "./getQuote"

/**
 * Executes a quote by fetching it, signing it, and then executing the signed quote.
 * @param client - The Mee client to use
 * @param params - The parameters for signing the quote
 * @returns The hash of the executed transaction
 * @example
 * const hash = await execute(client, {
 *   instructions: [
 *     ...
 *   ]
 * })
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
