import type { BaseMeeClient } from "../../createMeeClient"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

export type GetOnChainQuotePayload = { quote: GetQuotePayload } & {
  trigger: Trigger
}
export type GetOnChainQuoteParams = GetQuoteParams & {
  trigger: Trigger
}

/**
 * Get a fusion quote from the MEE service
 * @param client - The base MEE client
 * @param params - The parameters for the quote request
 * @returns The quote payload
 * @throws If the token does not support ERC20Permit
 *
 * @example
 * ```ts
 * const quote = await getOnChainQuote(meeClient, {
 *   instructions: [
 *     mcNexus.build({
 *       type: "default",
 *       data: {
 *         calls: [
 *           { to: "0x0000000000000000000000000000000000000000", gasLimit: 50000n, value: 0n }
 *         ],
 *         chainId: targetChain.id
 *       }
 *     })
 *   ],
 *   feeToken
 * })
 * ```
 */
export const getOnChainQuote = async (
  client: BaseMeeClient,
  parameters: GetOnChainQuoteParams
): Promise<GetOnChainQuotePayload> => {
  const {
    account: account_ = client.account,
    trigger,
    instructions,
    ...rest
  } = parameters

  const triggerTransfer = account_.build({
    type: "transferFrom",
    data: trigger
  })

  const quote = await getQuote(client, {
    path: "v1/quote-permit", // Use different endpoint for onchain quotes
    eoa: account_.signer.address,
    instructions: [triggerTransfer, ...instructions],
    ...rest
  })
  const trigger_ = {
    ...trigger,
    amount: BigInt(trigger.amount) + BigInt(quote.paymentInfo.tokenWeiAmount)
  }

  return { quote, trigger: trigger_ }
}

export default getOnChainQuote
