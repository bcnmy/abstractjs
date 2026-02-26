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
import {
  type SignSafeQuoteParams,
  type SignSafeQuotePayload,
  signSafeQuote
} from "./signSafeQuote"

/**
 * Union type for parameters that can be used with signFusionQuote
 */
export type SignFusionQuoteParameters =
  | SignPermitQuoteParams
  | SignOnChainQuoteParams
  | SignMmDtkQuoteParams
  | SignSafeQuoteParams

/**
 * Union type for the payload returned by signFusionQuote
 */
export type SignFusionQuotePayload = (
  | SignOnChainQuotePayload
  | SignPermitQuotePayload
  | SignSafeQuotePayload
) & {
  meeVersions: MeeVersionsWithChainId
  /** This flag is being used for trusted sponsorship backwards compatibility */
  isEIP712TrustedSponsorshipSupported: boolean
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
      meeVersions,
      isEIP712TrustedSponsorshipSupported: true
    }
  }

  // if safe account is provided, use safe-sa fusion mode
  if ("safeAccount" in parameters && "safeWalletClient" in parameters) {
    return {
      ...(await signSafeQuote(client, parameters as SignSafeQuoteParams)),
      meeVersions,
      isEIP712TrustedSponsorshipSupported: true
    }
  }

  // if it is not mm-dtk or safe, then it is permit or on-chain
  const signatureType =
    parameters.fusionQuote.quote.quoteType ||
    (await getQuoteType(client, parameters.fusionQuote))

  switch (signatureType) {
    case "permit": {
      const { trigger } = parameters.fusionQuote
      const deployment = client.account.deploymentOn(trigger.chainId, true)

      const { fallbackToOnchainMode, signedPermitQuotePayload } =
        await signPermitQuote({
          fusionQuote: parameters.fusionQuote,
          account: {
            owner: client.account.signer.address,
            spender: deployment.address,
            walletClient: deployment.walletClient,
            meeVersions
          }
        })

      // If there is any issue with permit fuctionality, the quote signing will fallback to onchain mode.
      // Fallback only happens if RPC issue, problem with permit values such as name, version, domain separator.
      if (fallbackToOnchainMode) {
        return {
          ...(await signOnChainQuote(client, parameters)),
          meeVersions,
          isEIP712TrustedSponsorshipSupported: true
        }
      }

      return {
        ...signedPermitQuotePayload,
        meeVersions,
        isEIP712TrustedSponsorshipSupported: true
      }
    }
    case "onchain":
      return {
        ...(await signOnChainQuote(client, parameters)),
        meeVersions,
        isEIP712TrustedSponsorshipSupported: true
      }
    default:
      throw new Error("Invalid quote type for fusion quote")
  }
}

export default signFusionQuote
