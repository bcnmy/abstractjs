import type { BaseMeeClient } from "../../createMeeClient"
import { getPaymentToken } from "./getPaymentToken"
import signOnChainQuote, {
  type SignOnChainQuotePayload,
  type SignOnChainQuoteParams
} from "./signOnChainQuote"
import {
  type SignPermitQuoteParams,
  type SignPermitQuotePayload,
  signPermitQuote
} from "./signPermitQuote"

export type SignFusionQuoteParameters =
  | SignPermitQuoteParams
  | SignOnChainQuoteParams

export type SignFusionQuotePayload =
  | SignOnChainQuotePayload
  | SignPermitQuotePayload

/**
 * Signs a fusion quote
 * @param client - The Mee client to use
 * @param params - The parameters for the quote
 * @returns The signed quote
 * @example
 * const signedQuote = await signFusionQuote(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount
 * })
 */
export const signFusionQuote = async (
  client: BaseMeeClient,
  parameters: SignFusionQuoteParameters
): Promise<SignFusionQuotePayload> => {
  const { permitEnabled } = await getPaymentToken(
    client,
    parameters.fusionQuote.trigger
  )

  return permitEnabled
    ? signPermitQuote(client, parameters)
    : signOnChainQuote(client, parameters)
}

export default signFusionQuote
