import type { Hex, TransactionReceipt } from "viem"
import type { BaseMultichainSmartAccount } from "../toMultiChainNexusAccount"

/**
 * Parameters for checking if the account is delegated
 * @property account - {@link BaseMultichainSmartAccount} The multichain smart account to check if it is delegated
 */
export type WaitForTransactionReceiptParameters = {
  account: BaseMultichainSmartAccount
  hashes: Hex[]
}

/**
 * The payload for the unDelegate function
 * @property receipts - The transaction hashes of the undelegate transactions
 */
export type WaitForTransactionReceiptPayload = {
  receipts: TransactionReceipt[]
  status: TransactionReceipt["status"]
}

/**
 * Undelegates the account
 *
 * @param parameters - {@link WaitForTransactionReceiptParameters} Configuration for undelegating the account
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
export const waitForTransactionReceipts = async (
  parameters: WaitForTransactionReceiptParameters
): Promise<WaitForTransactionReceiptPayload> => {
  const receipts = await Promise.all(
    parameters.account.deployments.map(({ publicClient }, i) =>
      publicClient.waitForTransactionReceipt({ hash: parameters.hashes[i] })
    )
  )
  const failure = receipts.find((receipt) => receipt.status !== "success")
  return { receipts, status: failure ? failure.status : "success" }
}
