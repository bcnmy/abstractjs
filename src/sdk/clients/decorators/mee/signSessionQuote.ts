import {
  type GetOnChainQuotePayload,
  type GetPermitQuotePayload,
  type GetQuotePayload,
  type SignFusionQuotePayload,
  signFusionQuote
} from "."
import type { BaseMeeClient } from "../../createMeeClient"
import type { BaseSessionQuoteResponse } from "./getSessionQuote"
import signQuote, { type SignQuotePayload } from "./signQuote"

/**
 * Parameters required for signing a session quote
 */
export type SignSessionQuoteParams = BaseSessionQuoteResponse

/**
 * Signs a session quote.
 * If quoteType is "simple", signs using signQuote.
 * Otherwise, signs using signFusionQuote.
 *
 * @param client - The Mee client instance
 * @param params - Parameters with quote and quote type
 * @returns A promise resolving to the signed quote payload
 *
 * @example
 * ```typescript
 * const signed = await signSessionQuote(client, {
 *   quoteType: "simple",
 *   quote: { ... } // GetOnChainQuotePayload or GetPermitQuotePayload, etc.
 * });
 * ```
 */
export const signSessionQuote = async (
  client: BaseMeeClient,
  params: SignSessionQuoteParams
): Promise<SignQuotePayload | SignFusionQuotePayload> => {
  const { quoteType, quote } = params

  if (quoteType === "simple") {
    return await signQuote(client, {
      quote: quote as GetQuotePayload
    })
  }

  return await signFusionQuote(client, {
    fusionQuote: quote as GetPermitQuotePayload | GetOnChainQuotePayload
  })
}
