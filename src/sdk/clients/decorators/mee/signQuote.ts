import { type Hex, concatHex } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import type { BaseMeeClient } from "../../createMeeClient"

import type { GetQuotePayload } from "./getQuote"

/**
 * Parameters required for requesting a quote from the MEE service
 * @interface SignQuoteParams
 */
export type SignQuoteParams = {
  /** The quote to sign */
  quote: GetQuotePayload
  /** Optional smart account to execute the transaction. If not provided, uses the client's default account */
  account?: MultichainSmartAccount
}

export type SignQuotePayload = GetQuotePayload & {
  /** The signature of the quote */
  signature: Hex
}

/**
 * Signs a quote
 * @param client - The Mee client to use
 * @param params - The parameters for the quote
 * @returns The signed quote
 * @example
 * const signedQuote = await signQuote(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount
 * })
 */
export const signQuote = async (
  client: BaseMeeClient,
  params: SignQuoteParams
): Promise<SignQuotePayload> => {
  const { account: account_ = client.account, quote } = params

  const signer = account_.signer

  const signedMessage = await signer.signMessage({
    message: { raw: quote.hash }
  })

  return {
    ...quote,
    signature: concatHex(["0x00", signedMessage])
  }
}

export default signQuote
