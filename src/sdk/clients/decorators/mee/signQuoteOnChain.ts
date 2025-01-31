import {
  http,
  type Hex,
  concatHex,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  publicActions
} from "viem"
import type { Call } from "../../../account/utils/Types"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload } from "./getQuote"
import type { SignFusionQuoteParams } from "./signPermitQuote"

export const FUSION_NATIVE_TRANSFER_PREFIX = "0x150b7a02"

export type SignQuoteOnChainPayload = GetQuotePayload & {
  /** The signature of the quote */
  signature: Hex
}

/**
 * Signs a fusion quote
 * @param client - The Mee client to use
 * @param params - The parameters for the fusion quote
 * @returns The signed quote
 * @example
 * const signedQuote = await signQuoteOnChain(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount
 * })
 */
export const signQuoteOnChain = async (
  client: BaseMeeClient,
  params: SignFusionQuoteParams
): Promise<SignQuoteOnChainPayload> => {
  const {
    account: account_ = client.account,
    quote,
    trigger,
    quote: { paymentInfo }
  } = params

  const {
    chainId = Number(paymentInfo.chainId),
    address = getAddress(paymentInfo.token),
    amount = BigInt(paymentInfo.tokenWeiAmount)
  } = trigger ?? {}

  const nexusAddress = account_.addressOn(chainId, true)
  const { chain } = account_.deploymentOn(chainId, true)

  const triggerCall: Call = {
    to: address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [nexusAddress, amount]
    })
  }

  // If the data field is empty, a prefix must be added in order for the
  // chain not to reject the transaction. This is done in cases when the
  // user is using the transfer of native gas to the SCA as the trigger
  // transaction
  const dataOrPrefix = triggerCall.data ?? FUSION_NATIVE_TRANSFER_PREFIX

  const call = {
    ...triggerCall,
    data: concatHex([dataOrPrefix, quote.hash])
  }

  const signer = account_.signer
  const masterClient = createWalletClient({
    account: signer,
    chain,
    transport: http()
  }).extend(publicActions)

  const hash = await masterClient.sendTransaction(call)
  await masterClient.waitForTransactionReceipt({ hash, confirmations: 1 })

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

export default signQuoteOnChain
