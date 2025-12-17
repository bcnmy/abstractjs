import type { Address } from "viem"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import type { BaseMeeClient } from "../../createMeeClient"
import { prepareInstructions } from "./getFusionQuote"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"
import type { TokenTrigger, Trigger } from "./signPermitQuote"

// TODO: adjust via tests
export const DEFAULT_VERIFICATION_GAS_LIMIT_FOR_SAFE = 200_000n

/**
 * Response payload for a Safe Smart Account quote request.
 * Combines the standard quote payload with Safe-specific trigger information.
 */
export type GetSafeQuotePayload = { quote: GetQuotePayload } & {
  /**
   * Trigger information containing payment token details and total amount
   * (including both the original amount and gas fees)
   * @see {@link Trigger}
   */
  trigger: Trigger
}

/**
 * Parameters for requesting a Safe Smart Account quote
 */
export type GetSafeQuoteParams = GetQuoteParams & {
  /**
   * Trigger information for the Safe SA transaction
   * @see {@link Trigger}
   */
  trigger: TokenTrigger
  /**
   * The Gnosis Safe smart account address that will be the master account
   * This is the address that holds the funds and will sign the Safe transaction
   */
  safeAccount: Address

  /** For fusion mode, batching will be always true by default */
  batch?: boolean

  feePayer?: undefined
}

/**
 * Gets a quote for a Safe Smart Account fusion transaction from the MEE service.
 * This method is used when the master account is a Gnosis Safe multisig.
 * The flow works by having Safe signers sign a Safe transaction that approves
 * tokens for the orchestrator to use in the payment userOp.
 *
 * @param client - The base MEE client instance
 * @param parameters - Parameters for the Safe quote request
 * @param parameters.trigger - Payment token and amount information
 * @param parameters.safeAccount - The Gnosis Safe address that holds the funds
 * @param parameters.instructions - Array of transaction instructions to execute
 * @param [parameters.account] - Optional account to use (defaults to client.account)
 *
 * @returns Promise resolving to quote payload with Safe-specific trigger information
 *
 * @example
 * ```typescript
 * const quote = await getSafeQuote(meeClient, {
 *   instructions: [
 *     mcNexus.build({
 *       type: "default",
 *       data: {
 *         calls: [{ to: "0x...", gasLimit: 50000n, value: 0n }],
 *         chainId: base.id
 *       }
 *     })
 *   ],
 *   trigger: {
 *     tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     chainId: 1,
 *     amount: 1000000n // 1 USDC (6 decimals)
 *   },
 *   safeAccount: "0x..." // Gnosis Safe address
 * });
 * ```
 *
 * @throws Will throw an error if:
 * - The trigger parameters are invalid
 * - The quote request fails
 */
export const getSafeQuote = async (
  client: BaseMeeClient,
  parameters: GetSafeQuoteParams
): Promise<GetSafeQuotePayload> => {
  const {
    account: account_ = client.account,
    trigger,
    cleanUps,
    instructions,
    batch = true,
    gasLimit,
    verificationGasLimit,
    safeAccount,
    ...rest
  } = parameters

  const resolvedInstructions = await resolveInstructions(instructions)

  const sender = safeAccount
  const spender = account_.addressOn(trigger.chainId, true)

  // By default the trigger amount will be deposited to sca account.
  // if a custom recipient is defined ? It will deposit to the recipient address
  const recipient = trigger.recipientAddress || spender

  const { triggerGasLimit, triggerAmount, batchedInstructions } =
    await prepareInstructions(client, {
      resolvedInstructions,
      trigger,
      owner: sender,
      spender,
      recipient,
      account: account_,
      batch
    })

  const triggerInfo: Trigger = {
    tokenAddress: trigger.tokenAddress,
    chainId: trigger.chainId,
    gasLimit: triggerGasLimit,
    amount: triggerAmount, // Amount without fees and fees will be added below
    ...(trigger.approvalAmount
      ? { approvalAmount: trigger.approvalAmount }
      : {}),
    ...(trigger.recipientAddress
      ? { recipientAddress: trigger.recipientAddress }
      : {})
  }

  // Using the quote-permit endpoint because the Safe Txn 
  // will approve whatever is required to be approved, so the
  // rest part of the flow is similar to the regular permit fusion mode,
  // only in permit mode the 2612 permit approves tokens, here the Safe Txn 
  // approves tokens (or transfers native tokens to the orchestrator)
  const quote = await getQuote(
    client,
    {
      path: "quote-permit",
      eoa: sender, // it is the Safe smart account address, however param is named `eoa` for backward compatibility
      instructions: batchedInstructions,
      gasLimit: gasLimit || triggerGasLimit,
      batch,
      verificationGasLimit:
        verificationGasLimit || DEFAULT_VERIFICATION_GAS_LIMIT_FOR_SAFE,
      ...(cleanUps ? { cleanUps } : {}),
      ...rest
    },
    "safe-sa",
    triggerInfo
  )

  // For useMaxAvailableFunds case, fees will be taken from max available funds.
  // else it will be explicitly defined here
  let fees = trigger.useMaxAvailableFunds
    ? 0n
    : BigInt(quote.paymentInfo.tokenWeiAmount)

  if (rest.sponsorship) {
    // For sponsorship, user will never pay fee. So the trigger amount never include fees
    fees = 0n
  }

  triggerInfo.amount += fees

  return {
    quote,
    trigger: triggerInfo
  }
}

export default getSafeQuote
