import { type Hex, concatHex } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import type { BaseMeeClient } from "../../createMeeClient"

import type { AnyData } from "../../../modules"
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
 * Prepares the payload required for signing a quote.
 * This function extracts the hash from the quote and formats it as a signable message.
 * The returned object contains the signable payload and optional metadata (currently empty, but can be extended).
 *
 * @param quote - The quote payload to be signed
 * @returns An object containing the signable payload and metadata
 *
 * @example
 * ```typescript
 * const { signablePayload, metadata } = prepareSignableQuotePayload(quotePayload);
 * // signablePayload: { message: { raw: quotePayload.hash } }
 * // metadata: {}
 * ```
 */
export const prepareSignableQuotePayload = (quote: GetQuotePayload) => {
  return {
    signablePayload: {
      message: { raw: quote.hash }
    },
    metadata: {}
  }
}

/**
 * Formats the signed quote payload by attaching the signature to the original quote.
 * The signature is prefixed and concatenated as required by the MEE service.
 * Metadata is currently unused but reserved for future extensibility.
 *
 * @param quote - The original quote payload
 * @param _metadata - Optional metadata (currently unused)
 * @param signature - The signature to attach to the quote
 * @returns The signed quote payload with the signature field
 *
 * @example
 * ```typescript
 * const signedQuote = formatSignedQuotePayload(quotePayload, {}, signature);
 * // signedQuote: { ...quotePayload, signature: '0x177eee00<signature>' }
 * ```
 */
export const formatSignedQuotePayload = (
  quote: GetQuotePayload,
  _metadata: Record<string, AnyData>, // This is unused for now. But can be extended in future
  signature: Hex
): SignQuotePayload => {
  return {
    ...quote,
    signature: concatHex([DEFAULT_PREFIX, signature])
  }
}

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

  const { signablePayload, metadata } = prepareSignableQuotePayload(quote)

  const signedMessage = await signer.signMessage(signablePayload)

  return formatSignedQuotePayload(quote, metadata, signedMessage)
}

export default signQuote
