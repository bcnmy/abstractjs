import type { BaseMeeClient } from "../../createMeeClient"
import executeSignedQuote, {
  type ExecuteSignedQuotePayload
} from "./executeSignedQuote"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { TokenTrigger } from "./signPermitQuote"
import {
  type SignSessionQuoteParams,
  signSessionQuote
} from "./signSessionQuote"

/**
 * Executes a session quote by signing it and then executing the signed quote.
 * This is a two-step process that:
 * 1. Signs the session quote using {@link signSessionQuote}
 * 2. Executes the signed session quote using {@link executeSignedQuote}
 *
 * @param client - The Mee client instance used for API interactions
 * @param params - Parameters for signing the session quote
 * @param params.quoteType - The type of the session quote ("simple" or fusion types)
 * @param params.quote - The session quote object to be signed and executed
 *
 * @returns Promise resolving to {@link ExecuteSignedQuotePayload} containing:
 * - hash: The transaction hash
 *
 * @example
 * ```typescript
 * const result = await executeSessionQuote(client, {
 *   quoteType: "simple",
 *   quote: { ... } // GetOnChainQuotePayload or GetPermitQuotePayload, etc.
 * });
 * // result: { hash: "0x..." }
 * ```
 */
export const executeSessionQuote = async (
  client: BaseMeeClient,
  params: SignSessionQuoteParams
): Promise<ExecuteSignedQuotePayload> => {
  const { quoteType, quote } = params

  const signedQuote = await signSessionQuote(client, { quoteType, quote })

  if (quoteType === "simple") {
    return executeSignedQuote(client, { signedQuote })
  }

  const fusionQuote = quote as GetPermitQuotePayload | GetOnChainQuotePayload

  let trigger: TokenTrigger | undefined = undefined

  // If there is no call ? It is always TokenTrigger
  if (fusionQuote.trigger && !fusionQuote.trigger.call) {
    trigger = fusionQuote.trigger
  }

  return executeSignedQuote(client, {
    signedQuote: {
      ...signedQuote,
      trigger
    }
  })
}

export default executeSessionQuote
