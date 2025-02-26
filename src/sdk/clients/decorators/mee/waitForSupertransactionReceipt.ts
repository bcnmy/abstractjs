import type { BaseMeeClient } from "../../createMeeClient"
import getSupertransactionReceipt, {
  type GetSupertransactionReceiptParams,
  type GetSupertransactionReceiptPayload
} from "./getSupertransactionReceipt"

export const DEFAULT_POLLING_INTERVAL = 1000

/**
 * Parameters for waiting for a supertransaction receipt
 */
export type WaitForSupertransactionReceiptParams =
  GetSupertransactionReceiptParams

/**
 * Response payload containing the supertransaction receipt details
 */
export type WaitForSupertransactionReceiptPayload =
  GetSupertransactionReceiptPayload

/**
 * Waits for a supertransaction receipt to be available. This function polls the MEE service
 * until the transaction is confirmed across all involved chains.
 *
 * @param client - The Mee client instance
 * @param params - Parameters for retrieving the receipt
 * @param params.hash - The supertransaction hash to wait for
 *
 * @returns Promise resolving to the supertransaction receipt
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

  const explorerResponse = await getSupertransactionReceipt(client, parameters)
  const FINALLY_STATUSES = ["SUCCESS", "ERROR"]

  if (!FINALLY_STATUSES.includes(explorerResponse.transactionStatus)) {
    await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    return await waitForSupertransactionReceipt(client, parameters)
  }

  return explorerResponse
}

export default waitForSupertransactionReceipt
