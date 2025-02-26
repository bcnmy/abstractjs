import { batchInstructions } from "../../../account/utils/batchInstructions"
import type { BaseMeeClient } from "../../createMeeClient"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

/**
 * Payload returned when requesting an on-chain quote.
 * Includes both the standard quote payload and trigger information.
 */
export type GetOnChainQuotePayload = { quote: GetQuotePayload } & {
  /**
   * Trigger information containing payment token details and amount
   * @see {@link Trigger}
   */
  trigger: Trigger
}

/**
 * Parameters for requesting an on-chain quote
 */
export type GetOnChainQuoteParams = GetQuoteParams & {
  /**
   * Trigger information for the transaction
   * @see {@link Trigger}
   */
  trigger: Trigger
}

/**
 * Gets a quote for an on-chain transaction from the MEE service.
 * This method is used when the payment token doesn't support ERC20Permit
 * or when a standard on-chain transaction is preferred.
 *
 * @param client - The base MEE client instance
 * @param parameters - Parameters for the quote request
 * @param parameters.trigger - Payment token and amount information
 * @param parameters.instructions - Array of transaction instructions to execute
 * @param [parameters.account] - Optional account to use (defaults to client.account)
 *
 * @returns Promise resolving to quote payload with trigger information
 *
 * @example
 * ```typescript
 * const quote = await getOnChainQuote(meeClient, {
 *   instructions: [
 *     mcNexus.build({
 *       type: "default",
 *       data: {
 *         calls: [
 *           {
 *             to: "0x0000000000000000000000000000000000000000",
 *             gasLimit: 50000n,
 *             value: 0n
 *           }
 *         ],
 *         chainId: base.id
 *       }
 *     })
 *   ],
 *   trigger: {
 *     paymentToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     amount: "1000000" // 1 USDC (6 decimals)
 *   }
 * });
 * ```
 *
 * @throws Will throw an error if the token does not support ERC20Permit
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

  const recipient = account_.deploymentOn(trigger.chainId, true).address
  const sender = account_.signer.address

  const triggerTransfer = account_.build({
    type: "transferFrom",
    data: { ...trigger, recipient, sender }
  })

  const batchedInstructions = await batchInstructions({
    account: account_,
    triggerCall: triggerTransfer,
    instructions
  })

  const quote = await getQuote(client, {
    path: "v1/quote-permit", // Use different endpoint for onchain quotes
    eoa: account_.signer.address,
    instructions: batchedInstructions,
    ...rest
  })
  const trigger_ = {
    ...trigger,
    amount: BigInt(trigger.amount) + BigInt(quote.paymentInfo.tokenWeiAmount)
  }

  return { quote, trigger: trigger_ }
}

export default getOnChainQuote
