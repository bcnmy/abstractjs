import type { UserOpStatus } from "../../clients/decorators/mee"
import type { MeeFilledUserOpDetails } from "../../clients/decorators/mee/getQuote"

/**
 * Transaction status result including status and finality information
 */
export type TransactionStatusResult = {
  /** The overall status of the transaction */
  status: UserOpStatus["executionStatus"]
  /** Whether the transaction has reached a final state (FAILED, MINED_SUCCESS, MINED_FAIL) */
  isFinalised: boolean
  /** Error message when a transaction has failed, empty string otherwise */
  message: string
}

/**
 * Final status types
 */
export const FINAL_STATUSES = ["FAILED", "MINED_SUCCESS", "MINED_FAIL"]

/**
 * Calculate the overall transaction status based on individual userOp statuses.
 *
 * Status definitions:
 * - PENDING: node waiting for conditions to be met
 * - FAILED: off chain failure
 * - MINING: tx broadcasted
 * - MINED_SUCCESS: tx mined and userOp status: success
 * - MINED_FAIL: tx mined and userOp status: fail
 *
 * Overall status calculation rules:
 * 1. If any userOp has FAILED status, return "FAILED" (off-chain failure)
 * 2. If any userOp has MINED_FAIL status, return "MINED_FAIL" (on-chain failure)
 * 3. If any userOp has PENDING status, return "PENDING" (still waiting for conditions)
 * 4. If any userOp has MINING status, return "MINING" (transaction in progress)
 * 5. If all userOps have MINED_SUCCESS status, return "MINED_SUCCESS" (all successful)
 * 6. Otherwise, return "PENDING" (default fallback)
 *
 * @param userOps - The user operations with their execution statuses
 * @returns The calculated overall transaction status with finality information
 */
export const parseTransactionStatus = async (
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
): Promise<TransactionStatusResult> => {
  // Handle empty userOps case
  if (!userOps || userOps.length === 0) {
    return {
      status: "PENDING",
      isFinalised: false,
      message: ""
    }
  }

  // Payment and cleanup userOps status are not considered for main status
  const userOpsWithoutPaymentAndCleanup = userOps.filter(
    (usop) => !usop.isCleanUpUserOp
  )

  const statusMap = {
    // If there is a cleanup user op failue ? Ignore it
    hasFailedOps: userOpsWithoutPaymentAndCleanup.some(
      (userOp) => userOp.executionStatus === "FAILED"
    ),
    // If there is a cleanup user op mining failue ? Ignore it
    hasMinedFailOps: userOpsWithoutPaymentAndCleanup.some(
      (userOp) => userOp.executionStatus === "MINED_FAIL"
    ),
    hasPendingOps: userOpsWithoutPaymentAndCleanup.some(
      (userOp) => userOp.executionStatus === "PENDING"
    ),
    hasMiningOps: userOpsWithoutPaymentAndCleanup.some(
      (userOp) => userOp.executionStatus === "MINING"
    ),
    // If there is a cleanup user op failue / mining failure ? Ignore it and mark the sprTx successful.
    allMinedSuccess: userOpsWithoutPaymentAndCleanup.every(
      (userOp) => userOp.executionStatus === "MINED_SUCCESS"
    ),
    // Check if all userOps have a final state
    allFinalised: userOpsWithoutPaymentAndCleanup.every(
      (userOp) =>
        userOp.executionStatus === "FAILED" ||
        userOp.executionStatus === "MINED_FAIL" ||
        userOp.executionStatus === "MINED_SUCCESS"
    )
  }
  // Calculate status and finality
  let status: UserOpStatus["executionStatus"] = "PENDING" // Default status
  let message = "" // Default empty message

  // Calculate overall status based on priority
  if (statusMap.hasFailedOps) {
    status = "FAILED"
    // Find the first failed userOp to get error details
    const failedUserOpIndex = userOpsWithoutPaymentAndCleanup.findIndex(
      (userOp) => userOp.executionStatus === status
    )
    const failedUserOp = userOpsWithoutPaymentAndCleanup[failedUserOpIndex]
    message = `[${failedUserOpIndex}] ${failedUserOp?.executionError || "Transaction failed off-chain"}`
  } else if (statusMap.hasMinedFailOps) {
    status = "MINED_FAIL"
    // Find the first mined-failed userOp to get error details
    const minedFailUserOpIndex = userOpsWithoutPaymentAndCleanup.findIndex(
      (userOp) => userOp.executionStatus === status
    )
    const minedFailUserOp =
      userOpsWithoutPaymentAndCleanup[minedFailUserOpIndex]
    message = `[${minedFailUserOpIndex}] ${minedFailUserOp?.executionError || "Transaction failed on-chain"}`
  } else if (statusMap.hasMiningOps) {
    status = "MINING"
    const pendingUserOpIndex = userOpsWithoutPaymentAndCleanup.findIndex(
      (userOp) => userOp.executionStatus === status
    )
    message = `[${pendingUserOpIndex}] Transaction is mining, waiting for blockchain confirmation`
  } else if (statusMap.hasPendingOps) {
    status = "PENDING"
    const pendingUserOpIndex = userOpsWithoutPaymentAndCleanup.findIndex(
      (userOp) => userOp.executionStatus === status
    )
    const pendingUserOp = userOpsWithoutPaymentAndCleanup[pendingUserOpIndex]
    message = `[${pendingUserOpIndex}] ${pendingUserOp?.executionError || "Transaction is pending, waiting for conditions to be met"}`
  } else if (statusMap.allMinedSuccess) {
    status = "MINED_SUCCESS"
    const minedSuccessUserOpIndex = userOpsWithoutPaymentAndCleanup.findIndex(
      (userOp) => userOp.executionStatus === status
    )
    message = `[${minedSuccessUserOpIndex}] Transaction executed successfully`
  }

  const isFinalised =
    statusMap.allFinalised ||
    statusMap.hasFailedOps ||
    statusMap.hasMinedFailOps
  return {
    status,
    isFinalised,
    message
  }
}

export default parseTransactionStatus
