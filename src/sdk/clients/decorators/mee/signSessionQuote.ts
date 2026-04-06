import {
  type GetOnChainQuotePayload,
  type GetPermitQuotePayload,
  type GetQuotePayload,
  type SignFusionQuotePayload,
  signFusionQuote
} from "."
import { versionIsAtLeast } from "../../../account/utils/getVersion"
import { isP256Signer } from "../../../account/utils/toP256Signer"
import { MEEVersion } from "../../../constants"
import type { BaseMeeClient } from "../../createMeeClient"
import type { BaseSessionQuoteResponse } from "./getSessionQuote"
import signQuote, {
  type SignQuotePayload,
  formatSignedQuotePayload,
  getMeeVersionsForQuote,
  preparePersonalSignableQuotePayload
} from "./signQuote"

/**
 * Parameters required for signing a session quote
 */
export type SignSessionQuoteParams = BaseSessionQuoteResponse

/**
 * Signs a session quote.
 * For simple mode with MEE >= 2.2.1, uses personal sign on the raw userOpHash
 * (no MEE prefix, no SuperTx EIP-712 wrapping). This routes through
 * NoMeeFlowLib.validateSignatureForOwner on-chain, which does plain ECDSA
 * recovery against the raw userOpHash.
 *
 * We cannot use the MEE simple mode (0x177eee00 + SuperTx EIP-712) because
 * SmartSession calls K1MeeValidator.validateSignatureWithData externally,
 * and hashTypedDataForAccount(msg.sender, ...) would use SmartSession's
 * address instead of the account's — SmartSession doesn't implement
 * eip712Domain(), so it reverts.
 *
 * Session expiry is handled by SmartSession's own policies.
 *
 * For older versions or fusion quotes, delegates to the standard signing flow.
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
    const simpleQuote = quote as GetQuotePayload
    const account = client.account
    const signer = account.signer
    const isP256 = isP256Signer(signer)

    const startIndex = simpleQuote.paymentInfo.sponsored ? 1 : 0

    const meeVersions = getMeeVersionsForQuote(
      account,
      simpleQuote.userOps.slice(startIndex)
    )

    // For MEE >= 2.2.1, use personal sign on the raw hash (NoMee flow).
    // The session key signs the quote hash directly — no SuperTx wrapping.
    if (versionIsAtLeast(meeVersions[0].version.version, MEEVersion.V2_2_1)) {
      const { signablePayload, metadata } =
        preparePersonalSignableQuotePayload(simpleQuote)
      const personalSignature = await signer.signMessage(signablePayload)

      return formatSignedQuotePayload(
        simpleQuote,
        metadata,
        personalSignature,
        meeVersions,
        isP256
      )
    }

    // For older MEE versions, fall back to standard signing
    return await signQuote(client, { quote: simpleQuote })
  }

  return await signFusionQuote(client, {
    fusionQuote: quote as GetPermitQuotePayload | GetOnChainQuotePayload
  })
}
