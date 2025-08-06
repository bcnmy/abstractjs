import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import type { BaseMeeClient } from "../../createMeeClient"
import { prepareInstructions } from "./getFusionQuote"
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

  feePayer?: undefined
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
    gasLimit,
    ...rest
  } = parameters

  if (trigger.call) {
    throw new Error("Custom call trigger is not supported for permit quotes")
  }

  const owner = account_.signer.address // sender is an EOA which is the signer for the companion account_
  const spender = account_.addressOn(trigger.chainId, true)

  // By default the trigger amount will be deposited to sca account.
  // if a custom recipient is defined ? It will deposit to the recipient address
  const recipient = trigger.recipientAddress || spender

  const resolvedInstructions = await resolveInstructions(instructions)

  const { triggerGasLimit, triggerAmount, batchedInstructions } =
    await prepareInstructions(client, {
      resolvedInstructions,
      trigger,
      owner, // EOA address
      spender, // SCA address who gets the approval for spend initiation
      recipient, // Either the SCA takes amount for itself or transferred for custom recipient
      account: account_
    })

  const eoa = account_.signer.address

  const quote = await getQuote(client, {
    path: "quote-permit", // Use different endpoint for permit enabled tokens
    eoa,
    instructions: batchedInstructions,
    gasLimit: gasLimit || triggerGasLimit,
    ...(cleanUps ? { cleanUps } : {}),
    ...rest
  })

  // For useMaxAvailableFunds case, fees will be taken from max available funds.
  // else it will be explicitly defined here
  let fees = trigger.useMaxAvailableFunds
    ? 0n
    : BigInt(quote.paymentInfo.tokenWeiAmount)

  if (rest.sponsorship) {
    // For sponsorship, user will never pay fee. So the trigger amount never include fees
    fees = 0n
  }

  const amount = triggerAmount + fees

  return {
    quote,
    trigger: {
      tokenAddress: trigger.tokenAddress,
      chainId: trigger.chainId,
      gasLimit: triggerGasLimit,
      amount,
      ...(trigger.approvalAmount
        ? { approvalAmount: trigger.approvalAmount }
        : {}),
      ...(trigger.recipientAddress
        ? { recipientAddress: trigger.recipientAddress }
        : {})
    }
  }
}

export default getPermitQuote
