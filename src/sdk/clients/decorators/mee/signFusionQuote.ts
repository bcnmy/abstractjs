import type { MeeVersionsWithChainId } from "../../../account/utils/getVersion"
import type { BaseMeeClient } from "../../createMeeClient"
import { getQuoteType } from "./getQuoteType"
import { type SignMmDtkQuoteParams, signMMDtkQuote } from "./signMmDtkQuote"
import signOnChainQuote, {
  type SignOnChainQuotePayload,
  type SignOnChainQuoteParams
} from "./signOnChainQuote"
import {
  type SignPermitQuoteParams,
  type SignPermitQuotePayload,
  signPermitQuote
} from "./signPermitQuote"
import { getMeeVersionsForQuote } from "./signQuote"

/**
 * Union type for parameters that can be used with signFusionQuote
 */
export type SignFusionQuoteParameters =
  | SignPermitQuoteParams
  | SignOnChainQuoteParams
  | SignMmDtkQuoteParams

/**
 * Union type for the payload returned by signFusionQuote
 */
export type SignFusionQuotePayload = (
  | SignOnChainQuotePayload
  | SignPermitQuotePayload
) & {
  meeVersions: MeeVersionsWithChainId
}

/**
 * Signs a fusion quote by automatically selecting between permit and on-chain signing
 * based on the payment token's capabilities. If the token supports ERC20Permit,
 * it will use permit signing; otherwise, it will fall back to on-chain signing.
 *
 * @param client - The Mee client instance
 * @param parameters - Parameters for signing the fusion quote
 * @param parameters.fusionQuote - The fusion quote to sign
 * @param [parameters.account] - Optional account to use for signing
 *
 * @returns Promise resolving to the signed quote payload
 *
 * @example
 * ```typescript
 * const signedQuote = await signFusionQuote(meeClient, {
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
 * ```
 *
 * @throws Will throw an error if:
 * - The quote format is invalid
 * - The signing process fails
 * - The token information cannot be retrieved
 */
export const signFusionQuote = async (
  client: BaseMeeClient,
  parameters: SignFusionQuoteParameters
): Promise<SignFusionQuotePayload> => {
  const startIndex = parameters.fusionQuote.quote.paymentInfo.sponsored ? 1 : 0
  const meeVersions = getMeeVersionsForQuote(
    client.account,
    parameters.fusionQuote.quote.userOps.slice(startIndex)
  )

  if ("delegatorSmartAccount" in parameters) {
    return {
      ...(await signMMDtkQuote(client, parameters as SignMmDtkQuoteParams)),
      meeVersions
    }
  }
  // if it is not mm-dtk, then it is permit or on-chain
  const signatureType =
    parameters.fusionQuote.quote.quoteType ||
    (await getQuoteType(client, parameters.fusionQuote))

  switch (signatureType) {
    case "permit":
      return {
        ...(await signPermitQuote(client, parameters)),
        meeVersions
      }
    case "onchain":
      return {
        ...(await signOnChainQuote(client, parameters)),
        meeVersions
      }
    default:
      throw new Error("Invalid quote type for fusion quote")
  }
}

export default signFusionQuote
