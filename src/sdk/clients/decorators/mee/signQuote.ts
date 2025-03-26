import { type Hex, concatHex } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import type { BaseMeeClient } from "../../createMeeClient"

import type { GetQuotePayload } from "./getQuote"

/**
 * Parameters required for signing a quote from the MEE service
 */
export type SignQuoteParams = {
  /**
   * The quote payload to be signed
   * @see {@link GetQuotePayload}
   */
  quote: GetQuotePayload
  /**
   * Optional smart account to execute the transaction
   * If not provided, uses the client's default account
   */
  account?: MultichainSmartAccount
}

/**
 * Response payload containing the signed quote data
 */
export type SignQuotePayload = GetQuotePayload & {
  /**
   * The signature of the quote
   * Prefixed with '0x00' and concatenated with the signed message
   */
  signature: Hex
}

const DEFAULT_PREFIX = "0x177eee00"

/**
 * Signs a quote using the provided account's signer or the client's default account.
 * The signature is required for executing the quote through the MEE service.
 *
 * @param client - The Mee client instance
 * @param params - Parameters for signing the quote
 * @param params.quote - The quote to sign
 * @param [params.account] - Optional account to use for signing
 *
 * @returns Promise resolving to the quote payload with added signature
 *
 * @example
 * ```typescript
 * const signedQuote = await signQuote(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount // Optional
 * });
 * ```
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
    signature: concatHex([DEFAULT_PREFIX, signedMessage])
  }
}

export default signQuote
