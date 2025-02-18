import type { TransactionReceipt } from "viem"
import type { UserOpStatus } from "../../clients/decorators/mee"
import type { MeeFilledUserOpDetails } from "../../clients/decorators/mee/getQuote"

/**
 * Parses the transaction status based on the user operations and receipts
 * @param userOps - The user operations
 * @param receipts - The receipts
 * @param account - The account
 * @returns The transaction status
 *
 * @description
 * - If all transactions are fullfilled, return "SUCCESS"
 * - If all transactions are rejected, return "ERROR"
 * - If any transaction is pending, return "MINING"
 * - If any transaction is submitted, return "SUBMITTED"
 *
 */
export const parseTransactionStatus = async (
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[],
  receipts: PromiseSettledResult<TransactionReceipt>[]
): Promise<"SUBMITTED" | "MINING" | "SUCCESS" | "ERROR"> => {
  const statuses = userOps.map((userOp) => userOp.executionStatus)
  const statusPending = statuses.some((status) => status === "PENDING")
  const statusSuccess = statuses.some((status) => status === "SUCCESS")
  const fullfilledTxs = receipts.every(
    (receipt) => receipt.status === "fulfilled"
  )
  const rejectedTxs = receipts.some((receipt) => receipt.status === "rejected")
  if (statusPending) return "SUBMITTED"
  if (fullfilledTxs) return "SUCCESS"
  if (statusSuccess && rejectedTxs) return "MINING"
  return "ERROR"
}

export default parseTransactionStatus
