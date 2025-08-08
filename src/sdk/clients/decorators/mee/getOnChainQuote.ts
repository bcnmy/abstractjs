import { batchInstructions } from "../../../account/utils/batchInstructions"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import type { BaseMeeClient } from "../../createMeeClient"
import { prepareInstructions } from "./getFusionQuote"
import type { GetQuoteParams } from "./getQuote"
import { DEFAULT_GAS_LIMIT, type GetQuotePayload, getQuote } from "./getQuote"
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

  feePayer?: undefined
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
    gasLimit,
    ...rest
  } = parameters

  const resolvedInstructions = await resolveInstructions(instructions)

  if (trigger.call) {
    const batchedInstructions = await batchInstructions({
      account: account_,
      instructions: resolvedInstructions
    })
    const quote = await getQuote(client, {
      path: "quote",
      eoa: account_.signer.address,
      instructions: batchedInstructions,
      gasLimit: gasLimit || DEFAULT_GAS_LIMIT,
      ...(cleanUps ? { cleanUps } : {}),
      ...rest
    })

    return {
      quote,
      trigger
    }
  }

  const owner = account_.signer.address
  const spender = account_.addressOn(trigger.chainId, true)

  // By default the trigger amount will be deposited to sca account.
  // if a custom recipient is defined ? It will deposit to the recipient address
  const recipient = trigger.recipientAddress || spender

  const { triggerGasLimit, triggerAmount, batchedInstructions } =
    await prepareInstructions(client, {
      resolvedInstructions,
      trigger,
      owner, // EOA address
      spender, // For on chain quotes, the funds are directly deposited. So this param is not mostly used
      recipient, // Either the SCA takes amount for itself or transferred for custom recipient
      account: account_
    })

  // It uses the same endpoint (path) for onchain and permit quotes, as currently
  // the fusion on-chain txn for erc-20 tokens will always be 'approve' and never 'transfer'
  // so the MEE Node endpoint can be the same for both
  // there is also just a 'quote' endpoint, which applies to non-fusion superTxns
  const quote = await getQuote(client, {
    path: "quote-permit",
    eoa: account_.signer.address,
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

export default getOnChainQuote
