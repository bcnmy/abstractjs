import type { BaseMultichainSmartAccount } from "../toMultiChainNexusAccount"
import {
  type WaitForTransactionReceiptPayload,
  waitForTransactionReceipts
} from "./waitForTransactionReceipts"

/**
 * Parameters for checking if the account is delegated
 * @property account - {@link BaseMultichainSmartAccount} The multichain smart account to check if it is delegated
 */
export type UnDelegateParameters = {
  account: BaseMultichainSmartAccount
}

/**
 * The payload for the unDelegate function
 * @property receipts - The transaction hashes of the undelegate transactions
 */
export type UnDelegatePayload = WaitForTransactionReceiptPayload

/**
 * Undelegates the account
 *
 * @param parameters - {@link UnDelegateParameters} Configuration for undelegating the account
 * @param parameters.account - The multichain smart account to undelegate
 *
 * @returns Promise resolving to boolean
 *
 * @example
 * const receipts = await unDelegate({
 *   account: myMultichainAccount
 * });
 *
 * console.log(`Receipts: ${receipts}`);
 */
export const unDelegate = async (
  parameters: UnDelegateParameters
): Promise<UnDelegatePayload> => {
  const hashes = await Promise.all(
    parameters.account.deployments.map(({ unDelegate }) => unDelegate())
  )
  return await waitForTransactionReceipts({
    account: parameters.account,
    hashes
  })
}
