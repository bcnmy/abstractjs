import { erc20Abi } from "viem"
import type { BuildInstructionTypes } from "../../../account"
import { batchInstructions } from "../../../account/utils/batchInstructions"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import {
  greaterThanOrEqualTo,
  runtimeERC20AllowanceOf
} from "../../../modules/utils/composabilityCalls"
import type { BaseMeeClient } from "../../createMeeClient"
import { DEFAULT_GAS_LIMIT, type GetQuotePayload, getQuote } from "./getQuote"
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
    gasLimit,
    sponsorship,
    ...rest
  } = parameters

  const sender = account_.signer.address
  const recipient = account_.addressOn(trigger.chainId, true)

  let triggerAmount = 0n

  if (trigger.useMaxAvailableFunds) {
    const { publicClient } = client.account.deploymentOn(trigger.chainId, true)

    // EOA balance maximum available balance fetch
    const maxAvailableBalance = await publicClient.readContract({
      address: trigger.tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [sender]
    })

    triggerAmount = maxAvailableBalance
  } else {
    if (!trigger.amount) throw new Error("Trigger amount field is required")

    triggerAmount = trigger.amount
  }

  const resolvedInstructions = await resolveInstructions(instructions)

  const isComposable = resolvedInstructions.some(
    ({ isComposable }) => isComposable
  )

  // If max available funds ? the entire balance from EOA is added as transfer amount. But the fees will be taken from this
  // So we don't know a specific amount to be defined here before getting the quote. So we take runtimeBalance which will take
  // the remaining funds after the fee deduction.
  const transferFromAmount = trigger.useMaxAvailableFunds
    ? runtimeERC20AllowanceOf({
        owner: sender,
        spender: recipient,
        tokenAddress: trigger.tokenAddress,
        constraints: [greaterThanOrEqualTo(1n)]
      })
    : triggerAmount

  const triggerGasLimit = trigger.gasLimit
    ? trigger.gasLimit
    : DEFAULT_GAS_LIMIT

  const params: BuildInstructionTypes = {
    type: "transferFrom",
    data: {
      tokenAddress: trigger.tokenAddress,
      chainId: trigger.chainId,
      amount: transferFromAmount,
      recipient,
      sender,
      gasLimit: triggerGasLimit
    }
  }

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
    gasLimit: gasLimit || triggerGasLimit,
    sponsorship,
    ...(cleanUps ? { cleanUps } : {}),
    ...rest
  })

  // For useMaxAvailableFunds case, fees will be taken from max available funds.
  // else it will be explicitly defined here
  let fees = trigger.useMaxAvailableFunds
    ? 0n
    : BigInt(quote.paymentInfo.tokenWeiAmount)

  if (sponsorship) {
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

export default getPermitQuote
