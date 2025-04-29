import type { BuildInstructionTypes } from "../../../account"
import { batchInstructions } from "../../../account/utils/batchInstructions"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import type { BaseMeeClient } from "../../createMeeClient"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

/**
 * Response payload for a permit-enabled quote request.
 * Combines the standard quote payload with permit-specific trigger information.
 */
export type GetPermitQuotePayload = { quote: GetQuotePayload } & {
  /**
   * Trigger information containing payment token details and total amount
   * (including both the original amount and gas fees)
   * @see {@link Trigger}
   */
  trigger: Trigger
}

/**
 * Parameters for requesting a permit-enabled quote
 */
export type GetPermitQuoteParams = GetQuoteParams & {
  /**
   * Trigger information for the permit transaction
   * Must contain a permit-enabled token address
   * @see {@link Trigger}
   */
  trigger: Trigger
}

/**
 * Gets a quote for a permit-enabled transaction from the MEE service.
 * This method is used when the payment token supports ERC20Permit, allowing for
 * gasless approvals and more efficient transactions.
 *
 * @param client - The base MEE client instance
 * @param parameters - Parameters for the permit quote request
 * @param parameters.trigger - Payment token and amount information
 * @param parameters.instructions - Array of transaction instructions to execute
 * @param [parameters.account] - Optional account to use (defaults to client.account)
 *
 * @returns Promise resolving to quote payload with permit-specific trigger information
 *
 * @example
 * ```typescript
 * const quote = await getPermitQuote(meeClient, {
 *   instructions: [{
 *     to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *     data: "0x...",
 *     value: "0"
 *   }],
 *   trigger: {
 *     paymentToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     amount: "1000000", // 1 USDC (6 decimals)
 *     owner: "0x...", // Token owner address
 *     spender: "0x..." // Address approved to spend tokens
 *   }
 * });
 * ```
 *
 * @throws Will throw an error if:
 * - The token does not support ERC20Permit
 * - The trigger parameters are invalid
 * - The quote request fails
 */
export const getPermitQuote = async (
  client: BaseMeeClient,
  parameters: GetPermitQuoteParams
): Promise<GetPermitQuotePayload> => {
  const {
    account: account_ = client.account,
    trigger,
    cleanUps,
    instructions,
    ...rest
  } = parameters

  const sender = account_.signer.address
  const recipient = account_.addressOn(trigger.chainId, true)

  const resolvedInstructions = await resolveInstructions(instructions)

  const isComposable = resolvedInstructions.some(
    ({ isComposable }) => isComposable
  )

  const params: BuildInstructionTypes = {
    type: "transferFrom",
    data: { ...trigger, recipient, sender }
  }

  // The trigger transfer is the first instruction in the array.
  // It draws funds from the eoa to the nexus account with a transferFrom call.
  // If the instructions are composable, we build the composable transaction
  const triggerTransfer = await (isComposable
    ? account_.buildComposable(params)
    : account_.build(params))

  const batchedInstructions = await batchInstructions({
    account: account_,
    instructions: [...triggerTransfer, ...resolvedInstructions]
  })

  const quote = await getQuote(client, {
    path: "quote-permit", // Use different endpoint for permit enabled tokens
    eoa: account_.signer.address,
    instructions: batchedInstructions,
    ...(cleanUps ? { cleanUps } : {}),
    ...rest
  })

  // This trigger should have an amount that is the amount user wishes to spend, plus the gas fees
  const trigger_ = {
    ...trigger,
    amount: trigger.useMaxAvailableAmount
      ? BigInt(trigger.amount)
      : BigInt(trigger.amount) + BigInt(quote.paymentInfo.tokenWeiAmount)
  }

  return { quote, trigger: trigger_ }
}

export default getPermitQuote
