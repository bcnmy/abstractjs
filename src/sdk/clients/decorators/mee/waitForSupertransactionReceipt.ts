import {
  type Hex,
  type TransactionReceipt,
  type WaitForTransactionReceiptParameters,
  isHex
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import {
  getExplorerTxLink,
  getJiffyScanLink,
  getMeeScanLink
} from "../../../account/utils/explorer"
import { parseErrorMessage } from "../../../account/utils/parseErrorMessage"
import type { Url } from "../../createHttpClient"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"

export const DEFAULT_POLLING_INTERVAL = 1000

/**
 * Parameters for waiting for a supertransaction receipt
 */
export type WaitForSupertransactionReceiptParams =
  WaitForTransactionReceiptParameters & {
    /** Whether to wait for the transaction receipts to be available. Defaults to true. */
    wait?: boolean
  }

/**
 * The status of a user operation
 * @type UserOpStatus
 */
type UserOpStatus = {
  executionStatus: "SUCCESS" | "PENDING" | "ERROR"
  executionData: Hex
  executionError: string
}

/**
 * Response payload containing the supertransaction receipt details
 */
export type WaitForSupertransactionReceiptPayload = Omit<
  GetQuotePayload,
  "userOps"
> & {
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
  explorerLinks: Url[]
  receipts: TransactionReceipt[]
  /**
   * The transaction hash
   * @example "0x123..."
   */
  hash: Hex
  /**
   * Status of the transaction
   * @example "success"
   */
  status: string
}

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
  const { wait = true, confirmations = 2, ...params } = parameters
  const account = client.account
  const pollingInterval = client.pollingInterval ?? DEFAULT_POLLING_INTERVAL

  const explorerResponse =
    await client.request<WaitForSupertransactionReceiptPayload>({
      path: `v1/explorer/${params.hash}`,
      method: "GET"
    })

  const userOpError = explorerResponse.userOps.find(
    (userOp) => userOp.executionError
  )
  const errorFromExecutionData = explorerResponse.userOps.find(
    ({ executionData }) => !!executionData && !isHex(executionData)
  )

  const statuses = explorerResponse.userOps.map(
    (userOp) => userOp.executionStatus
  )
  const statusError = statuses.some((status) => status === "ERROR")
  if (/*userOpError || */ errorFromExecutionData || statusError) {
    throw new Error(
      parseErrorMessage(
        userOpError?.executionError ||
          errorFromExecutionData?.executionData ||
          "Unknown error"
      )
    )
  }

  const statusPending = statuses.some((status) => status === "PENDING")
  if (statusPending) {
    await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    return await waitForSupertransactionReceipt(client, {
      ...params,
      confirmations
    })
  }

  const receipts = wait
    ? await Promise.all(
        explorerResponse.userOps.map(({ chainId, executionData }) =>
          waitForTransactionReceipt(
            account.deploymentOn(Number(chainId), true).publicClient,
            { ...params, hash: executionData }
          )
        )
      )
    : []

  const explorerLinks = explorerResponse.userOps.reduce(
    (acc, userOp) => {
      acc.push(
        getExplorerTxLink(userOp.executionData, userOp.chainId),
        getJiffyScanLink(userOp.userOpHash)
      )
      return acc
    },
    [getMeeScanLink(params.hash)] as Url[]
  )

  return { ...explorerResponse, explorerLinks, receipts }
}

export default waitForSupertransactionReceipt
