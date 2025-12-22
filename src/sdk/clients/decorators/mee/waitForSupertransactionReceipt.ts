import type { Hex } from "viem"
import { parseTransactionStatus } from "../../../account/utils/parseTransactionStatus"
import type { BaseMeeClient } from "../../createMeeClient"
import getSupertransactionReceipt, {
  type GetSupertransactionReceiptParams,
  type GetSupertransactionReceiptPayloadWithReceipts
} from "./getSupertransactionReceipt"

export const DEFAULT_POLLING_INTERVAL = 1000

// memory storage for txHash by meeUserOp hash to send notification when txHash changes for meeUserOp
const txHashMapByMeeUserOpHash: Map<string, string> = new Map()

/**
 * Parameters for waiting for a supertransaction receipt
 */
export type WaitForSupertransactionReceiptParams =
  GetSupertransactionReceiptParams

/**
 * Response payload containing the supertransaction receipt details
 * This always includes receipts since we're waiting for them
 */
export type WaitForSupertransactionReceiptPayload =
  GetSupertransactionReceiptPayloadWithReceipts

/**
 * Waits for a supertransaction receipt to be available. This function polls the MEE service
 * until the transaction is confirmed across all involved chains.
 *
 * @param client - The Mee client instance
 * @param params - Parameters for retrieving the receipt
 * @param params.hash - The supertransaction hash to wait for
 *
 * @returns Promise resolving to the supertransaction receipt with blockchain receipts
 *
 * @example
 * ```typescript
 * const receipt = await waitForSupertransactionReceipt(meeClient, {
 *   hash: "0x123..."
 * });
 * // Returns:
 * // {
 * //   hash: "0x123...",
 * //   status: "success",
 * //   receipts: [{
 * //     chainId: "1",
 * //     hash: "0x456..."
 * //   }]
 * // }
 * ```
 *
 * @throws Will throw an error if:
 * - The transaction fails on any chain
 * - The polling times out
 * - The transaction hash is invalid
 */
export const waitForSupertransactionReceipt = async (
  client: BaseMeeClient,
  parameters: WaitForSupertransactionReceiptParams
): Promise<WaitForSupertransactionReceiptPayload> => {
  const pollingInterval = client.pollingInterval ?? DEFAULT_POLLING_INTERVAL

  // Force waitForReceipts to true for this function
  const paramsWithWait = { ...parameters, waitForReceipts: true }

  // Fetch receipt from MEE node
  const explorerResponse = await getSupertransactionReceipt(
    client,
    paramsWithWait
  )

  // Calculate the overall transaction status
  const userOps = explorerResponse.userOps || []

  for (const userOp of userOps) {
    const meeUserOpHash = userOp.meeUserOpHash.toLowerCase()

    if (userOp.executionData) {
      const latestTxHash = userOp.executionData.toLowerCase()

      const prevTxHash = txHashMapByMeeUserOpHash.get(meeUserOpHash)

      if (prevTxHash) {
        // If the previously seen txHash is not same with latest one, we sent a callback notification
        if (prevTxHash.toLowerCase() !== latestTxHash) {
          parameters?.onTransactionReplaced?.({
            meeUserOpHash: meeUserOpHash as Hex,
            txHash: latestTxHash as Hex
          })

          // Mark the newly seen tx hash
          txHashMapByMeeUserOpHash.set(meeUserOpHash, latestTxHash)
        }
      } else {
        // Mark the newly seen tx hash
        txHashMapByMeeUserOpHash.set(meeUserOpHash, latestTxHash)
      }
    }
  }

  // Handle error status cases (FAILED, MINED_FAIL)
  if (
    explorerResponse.transactionStatus === "FAILED" ||
    explorerResponse.transactionStatus === "MINED_FAIL"
  ) {
    throw new Error(explorerResponse.message || "Transaction failed")
  }

  // If transaction is not finalized yet, continue polling
  if (!explorerResponse.isFinalised) {
    await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    return await waitForSupertransactionReceipt(client, parameters)
  }

  return explorerResponse as WaitForSupertransactionReceiptPayload
}

export default waitForSupertransactionReceipt
