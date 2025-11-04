import { type GetEip712DomainReturnType, type Hex, concatHex } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import {
  isVersionOlder,
  versionMeetsRequirement
} from "../../../account/utils/getVersion"
import { Logger } from "../../../account/utils/logger"
import { MEEVersion } from "../../../constants"
import type { AnyData } from "../../../modules"
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
 * A map of chain ids to signatures
 */
export type SignedMessagesByChainId = {
  [chainId: string]: Hex
}

/**
 * Response payload containing the signed quote data
 */
export type SignQuotePayload = GetQuotePayload & {
  /**
   * The signature of the quote
   * Prefixed with 'DEFAULT_PREFIX' and concatenated with the signed message
   */
  signatures: SignedMessagesByChainId
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
export const preparePersonalSignableQuotePayload = (quote: GetQuotePayload) => {
  return {
    signablePayload: {
      message: { raw: quote.hash }
    },
    metadata: {}
  }
}

/**
 * Prepares the signable payload for the typed data signature.
 * It is a eip-712 data structure with the following fields:
 * - SuperTx(MeeUserOp[] meeUserOps)
 * - MeeUserOp(bytes32 userOpHash,uint256 lowerBoundTimestamp,uint256 upperBoundTimestamp)
 * - userOpHash and timestamps are present in the quote.userOps array for every userOp
 *
 * @param quote - The quote payload to be signed
 * @param eip712Domain - The eip712 domain to be used for the signature
 * @returns The signable payload
 *
 * @example
 * ```typescript
 * const { signablePayload } = prepareTypedDataSignableQuotePayload(quote, eip712Domain);
 * ```
 */

export const prepareTypedDataSignableQuotePayload = (
  quote: GetQuotePayload,
  eip712Domain: GetEip712DomainReturnType
) => {
  const signablePayload = {
    domain: {
      name: eip712Domain.domain.name, // Protocol name
      version: eip712Domain.domain.version // Protocol version
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
  signatures: SignedMessagesByChainId
): SignQuotePayload => {
  return {
    ...quote,
    // prepend every signature from signatures object with the DEFAULT_PREFIX
    signatures: Object.fromEntries(
      Object.entries(signatures).map(([chainId, signature]) => [
        chainId,
        concatHex([DEFAULT_PREFIX, signature])
      ])
    )
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

  const signedMessages: SignedMessagesByChainId = {}
  let metadata: Record<string, AnyData> = {}

  // 1. get all the unique chain ids from the quote.userOps array
  const uniqueChainIds = [
    ...new Set(quote.userOps.map((userOp) => userOp.chainId))
  ]

  // 2. Cache deployments to avoid redundant calls to deploymentOn()
  const deploymentsByChainId = new Map(
    uniqueChainIds.map((chainId) => [
      chainId,
      account_.deploymentOn(Number(chainId), true)
    ])
  )

  // 3. Separate the chains with MEE >= 2.2.0 and < 2.2.0 in a single pass
  const { chainsWithMEE220, chainsWithMEE210 } = uniqueChainIds.reduce(
    (acc, chainId) => {
      const deployment = deploymentsByChainId.get(chainId)!
      const version = deployment.version.version
      if (versionMeetsRequirement(version, MEEVersion.V2_2_0)) {
        acc.chainsWithMEE220.push(chainId)
      } else {
        acc.chainsWithMEE210.push(chainId)
      }
      return acc
    },
    { chainsWithMEE220: [] as string[], chainsWithMEE210: [] as string[] }
  )

  if (chainsWithMEE220.length > 0) {
    // 4. process typed data signatures
    // 4.1. identify the eip712 domain for each chain
    // 4.2. group the chains by the unique eip712 domain.name and domain.version
    // 4.3. if there's more than one group, console warn
    // 4.4. for each group, sign the quote with the typed data signature and add the signature to the signedMessages object for the respective chains
    const eip712DomainGroups = chainsWithMEE220.reduce(
      (acc, chainId) => {
        const eip712Domain = deploymentsByChainId.get(chainId)!.eip712Domain
        const key = `${eip712Domain.domain.name}-${eip712Domain.domain.version}`
        if (!acc[key]) {
          acc[key] = []
        }
        acc[key].push(chainId)
        return acc
      },
      {} as Record<string, string[]>
    )
    if (Object.keys(eip712DomainGroups).length > 1) {
      Logger.warn(
        "Multiple EIP-712 domains detected across chains. This will require multiple signatures.",
        {
          domainCount: Object.keys(eip712DomainGroups).length,
          domains: Object.keys(eip712DomainGroups),
          affectedChains: eip712DomainGroups
        }
      )
    }
    for (const chainIds of Object.values(eip712DomainGroups)) {
      const eip712Domain = deploymentsByChainId.get(chainIds[0])!.eip712Domain
      if (!eip712Domain) {
        throw new Error(`EIP-712 domain not found for chain ${chainIds[0]}`)
      }
      const result = prepareTypedDataSignableQuotePayload(quote, eip712Domain)
      const { signablePayload } = result
      metadata = result.metadata
      const typedDataSignature = await signer.signTypedData(signablePayload)
      // Use Object.assign to avoid nested loops
      Object.assign(
        signedMessages,
        Object.fromEntries(chainIds.map((id) => [id, typedDataSignature]))
      )
    }
  }
  // 5. process personal signatures
  if (chainsWithMEE210.length > 0) {
    const result = preparePersonalSignableQuotePayload(quote)
    const { signablePayload } = result
    metadata = result.metadata
    const personalSignature = await signer.signMessage(signablePayload)
    // Use Object.assign to avoid nested loops
    Object.assign(
      signedMessages,
      Object.fromEntries(
        chainsWithMEE210.map((chainId) => [chainId, personalSignature])
      )
    )
  }
  // informational alert for the dev
  if (chainsWithMEE210.length > 0 && chainsWithMEE220.length > 0) {
    Logger.warn(
      "Mixed MEE versions detected. Using both typed data signatures (MEE >= 2.2.0) and personal signatures (MEE < 2.2.0).",
      {
        chainsWithMEE220: chainsWithMEE220,
        chainsWithMEE210: chainsWithMEE210
      }
    )
  }
  return formatSignedQuotePayload(quote, metadata, signedMessages)
}

export default signQuote
