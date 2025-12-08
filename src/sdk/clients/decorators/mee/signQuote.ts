import { type GetEip712DomainReturnType, type Hex, concatHex } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import {
  type MeeVersionsWithChainId,
  versionIsAtLeast
} from "../../../account/utils/getVersion"
import { MEEVersion } from "../../../constants"
import type { AnyData } from "../../../modules"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"

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
   * The signature of the quote, prefixed with 'DEFAULT_PREFIX'
   * Since on the getQuote phase, we validate the consistent MEE versions across all chains,
   * we can use a single signature for the quote.
   */
  signature: Hex
  /**
   * The MEE versions of the quote
   */
  meeVersions?: MeeVersionsWithChainId
}

const DEFAULT_PREFIX = "0x177eee00"

/**
 * Prepares the payload required for signing a quote using personal message signatures.
 * This function extracts the hash from the quote and formats it as a signable message for personal signature (eth_sign).
 * Used for MEE versions < 2.2.0.
 * The returned object contains the signable payload and optional metadata (currently empty, but can be extended).
 *
 * @param quote - The quote payload to be signed
 * @returns An object containing the signable payload and metadata
 *
 * @example
 * ```typescript
 * const { signablePayload, metadata } = preparePersonalSignableQuotePayload(quotePayload);
 * // signablePayload: { message: { raw: quotePayload.hash } }
 * // metadata: {}
 * ```
 */
export const preparePersonalSignableQuotePayload = (quote: GetQuotePayload) => {
  return {
    signablePayload: {
      message: { raw: quote.hash }
    },
    metadata: {}
  }
}

/**
 * Prepares the signable payload for EIP-712 typed data signatures.
 * Used for MEE versions >= 2.2.1.
 * It is an EIP-712 data structure with the following fields:
 * - SuperTx(MeeUserOp[] meeUserOps)
 * - MeeUserOp(bytes32 userOpHash,uint256 lowerBoundTimestamp,uint256 upperBoundTimestamp)
 * - userOpHash and timestamps are present in the quote.userOps array for every userOp
 *
 * Note: Custom SuperTx data structs with mixed types are not supported yet.
 * Only SuperTx(MeeUserOp[] meeUserOps)
 *
 * @param quote - The quote payload to be signed
 * @param eip712Domain - The EIP-712 domain to be used for the signature
 * @returns An object containing the signable payload and metadata
 *
 * @example
 * ```typescript
 * const { signablePayload, metadata } = prepareTypedDataSignableQuotePayload(quote, eip712Domain);
 * // signablePayload: { domain, types, primaryType, message }
 * // metadata: {}
 * ```
 */

export const prepareTypedDataSignableQuotePayload = (
  quote: GetQuotePayload,
  eip712Domain: GetEip712DomainReturnType
) => {
  const signablePayload = {
    domain: {
      name: eip712Domain.domain.name // name
      // version: eip712Domain.domain.version // version, not used for the domain separator here
      // chainId and verifyingContract are not used for the domain separator here
      // since they are included in the userOpHash for every userOp
      // chainId:,
      // verifyingContract:
    },

    types: {
      MeeUserOp: [
        { name: "userOpHash", type: "bytes32" },
        { name: "lowerBoundTimestamp", type: "uint256" },
        { name: "upperBoundTimestamp", type: "uint256" }
      ],
      SuperTx: [{ name: "meeUserOps", type: "MeeUserOp[]" }]
    },

    primaryType: "SuperTx" as const,

    message: {
      meeUserOps: quote.userOps.map((userOp) => ({
        userOpHash: userOp.userOpHash,
        lowerBoundTimestamp: userOp.lowerBoundTimestamp,
        upperBoundTimestamp: userOp.upperBoundTimestamp
      }))
    }
  }

  return {
    signablePayload,
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
 * @param signature - The signature to be attached to the quote
 * @param meeVersion - The MEE version of the quote
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
  signature: Hex,
  meeVersions: MeeVersionsWithChainId
): SignQuotePayload => {
  return {
    ...quote,
    signature: concatHex([DEFAULT_PREFIX, signature]),
    meeVersions: meeVersions
  }
}

/**
 * Signs a quote using the provided account's signer or the client's default account.
 * Signs depending on the MEE version in the quote.
 * For MEE >= 2.2.1, uses EIP-712 typed data signatures.
 * For MEE < 2.2.1, uses personal message signatures.
 * This is for the `smart-account` mode only.
 *
 * The signatures are required for executing the quote through the MEE service.
 *
 * @param client - The Mee client instance
 * @param params - Parameters for signing the quote
 * @param params.quote - The quote to sign (may contain operations across multiple chains)
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
 * // signedQuote.signature: Hex
 * ```
 */
export const signQuote = async (
  client: BaseMeeClient,
  params: SignQuoteParams
): Promise<SignQuotePayload> => {
  const { account: account_ = client.account, quote } = params
  const signer = account_.signer

  const startIndex = quote.paymentInfo.sponsored ? 1 : 0
  const chainId = quote.userOps[startIndex].chainId

  // detect all the mee versions for the chains involved in the quote request
  // pass userOps starting with startIndex
  const meeVersions = getMeeVersionsForQuote(
    account_,
    quote.userOps.slice(startIndex)
  )

  // for MEE >= 2.2.1, use EIP-712 typed data signatures
  if (versionIsAtLeast(meeVersions[0].version.version, MEEVersion.V2_2_1)) {
    // get the eip712 domain
    // since we only use the name from the 712 domain (see prepareTypedDataSignableQuotePayload)
    // we can use the same eip712 domain for all the chains involved in the quote request
    const deployment = account_.deploymentOn(Number(chainId), true)
    const eip712Domain = await deployment.getEip712Domain()
    if (!eip712Domain) {
      throw new Error(
        `EIP-712 domain data not found for the multichain account on chain ${chainId}`
      )
    }
    const result = prepareTypedDataSignableQuotePayload(quote, eip712Domain)
    const { signablePayload, metadata } = result
    const typedDataSignature = await signer.signTypedData(signablePayload)

    return formatSignedQuotePayload(
      quote,
      metadata,
      typedDataSignature,
      meeVersions
    )
  }

  // for MEE < 2.2.1, use personal message signatures
  const result = preparePersonalSignableQuotePayload(quote)
  const { signablePayload, metadata } = result
  const personalSignature = await signer.signMessage(signablePayload)
  return formatSignedQuotePayload(
    quote,
    metadata,
    personalSignature,
    meeVersions
  )
}

/**
 *
 * @param account - The multichain orchestrator smart account
 * @param userOps - The user operations to get the MEE versions for. they do not include payment userOp if stx is sponsored
 * @returns The MEE versions for the user operations
 */
export const getMeeVersionsForQuote = (
  account: MultichainSmartAccount,
  userOps: MeeFilledUserOpDetails[]
): MeeVersionsWithChainId => {
  const usedChains = new Set<number>()

  for (const op of userOps) {
    usedChains.add(Number(op.chainId))
  }

  return Array.from(usedChains, (chainId) => {
    const deployment = account.deploymentOn(chainId, true)
    return {
      version: deployment.version,
      chainId
    }
  }) as MeeVersionsWithChainId
}

export default signQuote
