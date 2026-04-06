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
  prepareSessionTypedDataSignableQuotePayload
} from "./signQuote"

/**
 * Parameters required for signing a session quote
 */
export type SignSessionQuoteParams = BaseSessionQuoteResponse

/**
 * Signs a session quote.
 * For simple mode with MEE >= 2.2.1, uses session-specific EIP-712 signing
 * with plain bytes32 fields (no MeeUserOp timestamps) since smart sessions
 * validates via validateSignatureForOwner which receives raw userOpHashes.
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
    const chainId = simpleQuote.userOps[startIndex].chainId

    const meeVersions = getMeeVersionsForQuote(
      account,
      simpleQuote.userOps.slice(startIndex)
    )

    // For MEE >= 2.2.1, use session-specific EIP-712 signing (no timestamps)
    if (
      versionIsAtLeast(meeVersions[0].version.version, MEEVersion.V2_2_1)
    ) {
      const deployment = account.deploymentOn(Number(chainId), true)
      const eip712Domain = await deployment.getEip712Domain()
      if (!eip712Domain) {
        throw new Error(
          `EIP-712 domain data not found for the multichain account on chain ${chainId}`
        )
      }
      const { signablePayload, metadata } =
        prepareSessionTypedDataSignableQuotePayload(simpleQuote, eip712Domain)
      const typedDataSignature = await signer.signTypedData(signablePayload)

      return formatSignedQuotePayload(
        simpleQuote,
        metadata,
        typedDataSignature,
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
