import { getAddress } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"
import { getPaymentTokenByChainId } from "./getInfo"
import { type SignFusionQuoteParams, signPermitQuote } from "./signPermitQuote"
import type { SignQuotePayload } from "./signQuote"
import signQuoteOnChain from "./signQuoteOnChain"

export type GenericSignFusionQuoteParams = SignFusionQuoteParams & {
  /** Whether to use permit mode. Defaults to true */
  permitMode?: boolean
}

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
  parameters: GenericSignFusionQuoteParams
): Promise<SignQuotePayload> => {
  const {
    permitMode = true,
    trigger,
    quote,
    quote: { paymentInfo },
    ...rest
  } = parameters

  // Default the trigger to the paymentInfo if not provided
  const {
    chainId = Number(paymentInfo.chainId),
    address = getAddress(paymentInfo.token),
    amount = BigInt(paymentInfo.tokenWeiAmount)
  } = trigger ?? {}

  const params = { quote, trigger: { chainId, address, amount }, ...rest }

  if (!permitMode) {
    return signQuoteOnChain(client, params)
  }
  const { permitEnabled } = getPaymentTokenByChainId({
    info: client.info,
    targetTokenData: { chainId, address }
  })
  if (permitEnabled) {
    return signPermitQuote(client, params)
  }
  return signQuoteOnChain(client, params)
}

export default signFusionQuote
