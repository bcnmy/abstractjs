import { erc20Abi } from "viem"
import type { BuildInstructionTypes } from "../../../account/decorators/build"
import { batchInstructions } from "../../../account/utils/batchInstructions"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import {
  greaterThanOrEqualTo,
  runtimeERC20AllowanceOf
} from "../../../modules/utils/composabilityCalls"
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
    cleanUps,
    instructions,
    sponsorship,
    ...rest
  } = parameters

  const recipient = account_.deploymentOn(trigger.chainId, true).address
  const sender = account_.signer.address

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

  const params: BuildInstructionTypes = {
    type: "transferFrom",
    data: {
      tokenAddress: trigger.tokenAddress,
      chainId: trigger.chainId,
      amount: transferFromAmount,
      recipient,
      sender,
      gasLimit: 50_000n
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
    path: "quote-permit", // Use different endpoint for onchain quotes
    eoa: account_.signer.address,
    instructions: batchedInstructions,
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
      amount
    }
  }
}

export default getOnChainQuote
