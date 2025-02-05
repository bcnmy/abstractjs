import {
  http,
  type Hex,
  concatHex,
  createWalletClient,
  encodeAbiParameters,
  publicActions
} from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetQuotePayload } from "./getQuote"

export const FUSION_NATIVE_TRANSFER_PREFIX = "0x150b7a02"

export type SignOnChainQuotePayload = GetQuotePayload & {
  /** The signature of the quote */
  signature: Hex
}

export type SignOnChainQuoteParams = {
  /** The quote to sign */
  fusionQuote: GetOnChainQuotePayload
  /** Optional smart account to execute the transaction. If not provided, uses the client's default account */
  account?: MultichainSmartAccount
}

/**
 * Signs a fusion quote with a tx send client side.
 *
 * @param client - The Mee client to use
 * @param params - The parameters for the fusion quote
 * @returns The signed quote
 * @example
 * const signedQuote = await signOnChainQuote(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount
 * })
 */
export const signOnChainQuote = async (
  client: BaseMeeClient,
  params: SignOnChainQuoteParams
): Promise<SignOnChainQuotePayload> => {
  const {
    account: account_ = client.account,
    fusionQuote: { quote, trigger }
  } = params

  const { chain } = account_.deploymentOn(trigger.chainId, true)

  const [
    {
      calls: [triggerCall]
    }
  ] = await account_.build({
    type: "approve",
    data: { ...trigger, spender: account_.signer.address }
  })

  // If the data field is empty, a prefix must be added in order for the
  // chain not to reject the transaction. This is done in cases when the
  // user is using the transfer of native gas to the SCA as the trigger
  // transaction
  const dataOrPrefix = triggerCall.data ?? FUSION_NATIVE_TRANSFER_PREFIX
  const call = { ...triggerCall, data: concatHex([dataOrPrefix, quote.hash]) }

  const signer = account_.signer
  const masterClient = createWalletClient({
    account: signer,
    chain,
    transport: http()
  }).extend(publicActions)

  const hash = await masterClient.sendTransaction(call)
  await masterClient.waitForTransactionReceipt({ hash })

  const signature = concatHex([
    "0x01",
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [hash, BigInt(chain.id)]
    )
  ])

  return {
    ...quote,
    signature
  }
}

export default signOnChainQuote
