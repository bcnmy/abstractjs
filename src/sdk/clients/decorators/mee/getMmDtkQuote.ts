import type { MetaMaskSmartAccount } from "@metamask/delegation-toolkit"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import type { BaseMeeClient } from "../../createMeeClient"
import { prepareInstructions } from "./getFusionQuote"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"
import type { TokenTrigger, Trigger } from "./signPermitQuote"

/**
 * Response payload for a MM DTK quote request.
 * Combines the standard quote payload with MM DTK-specific trigger information.
 */
export type GetMmDtkQuotePayload = { quote: GetQuotePayload } & {
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
export type GetMmDtkQuoteParams = GetQuoteParams & {
  /**
   * Trigger information for the MM DTK transaction
   * @see {@link Trigger}
   */
  trigger: TokenTrigger
  /**
   * The MetaMask smart account to use for signing
   * the delegation
   */
  delegatorSmartAccount: MetaMaskSmartAccount

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
 * - The trigger parameters are invalid
 * - The quote request fails
 */
export const getMmDtkQuote = async (
  client: BaseMeeClient,
  parameters: GetMmDtkQuoteParams
): Promise<GetMmDtkQuotePayload> => {
  const {
    account: account_ = client.account,
    trigger,
    cleanUps,
    instructions,
    gasLimit,
    delegatorSmartAccount,
    ...rest
  } = parameters

  const resolvedInstructions = await resolveInstructions(instructions)

  const sender = delegatorSmartAccount.address
  const scaAddress = account_.addressOn(trigger.chainId, true)

  // By default the trigger amount will be deposited to sca account.
  // if a custom recipient is defined ? It will deposit to the recipient address
  const recipient = trigger.recipientAddress || scaAddress

  const { triggerGasLimit, triggerAmount, batchedInstructions } =
    await prepareInstructions(client, {
      resolvedInstructions,
      trigger,
      sender,
      scaAddress,
      recipient,
      account: account_
    })

  // using the quote-permit endpoint as the redeemed permission
  // will aprove whatever is required to be approved, so the
  // rest is similar to the regular permit fusion mode
  const quote = await getQuote(client, {
    path: "quote-permit",
    eoa: sender, // it is not an EOA, but a smart account in this case, however param is named `eoa` for backward compatibility, see `GetQuoteParams` type for more details
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
      amount,
      gasLimit: triggerGasLimit
    }
  }
}

export default getMmDtkQuote
