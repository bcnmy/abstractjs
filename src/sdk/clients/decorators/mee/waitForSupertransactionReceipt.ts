import { parseTransactionStatus } from "../../../account/utils/parseTransactionStatus"
import type { BaseMeeClient } from "../../createMeeClient"
import getSupertransactionReceipt, {
  type GetSupertransactionReceiptParams,
  type GetSupertransactionReceiptPayloadWithReceipts
} from "./getSupertransactionReceipt"

export const DEFAULT_POLLING_INTERVAL = 1000

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
  const statusResult = await parseTransactionStatus(userOps)

  // Update the response with the calculated status
  explorerResponse.transactionStatus = statusResult.status

  // Handle error status cases (FAILED, MINED_FAIL)
  if (
    statusResult.status === "FAILED" ||
    statusResult.status === "MINED_FAIL"
  ) {
    throw new Error(statusResult.message || "Transaction failed")
  }

  // If transaction is not finalized yet, continue polling
  if (!statusResult.isFinalised) {
    await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    return await waitForSupertransactionReceipt(client, parameters)
  }

  return explorerResponse as WaitForSupertransactionReceiptPayload
}

export default waitForSupertransactionReceipt
