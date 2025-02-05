import { type Hex, type TransactionReceipt, isHex } from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import { getAction } from "viem/utils"
import {
  getExplorerTxLink,
  getJiffyScanLink,
  getMeeScanLink
} from "../../../account/utils/explorer"
import type { AnyData } from "../../../modules/utils/Types"
import type { Url } from "../../createHttpClient"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"

export const DEFAULT_POLLING_INTERVAL = 1000

/**
 * Parameters required for requesting a quote from the MEE service
 * @type WaitForSupertransactionReceiptParams
 */
export type WaitForSupertransactionReceiptParams = {
  /** The hash of the super transaction */
  hash: Hex
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
 * The payload returned by the waitForSupertransactionReceipt function
 * @type WaitForSupertransactionReceiptPayload
 */
export type WaitForSupertransactionReceiptPayload = Omit<
  GetQuotePayload,
  "userOps"
> & {
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
  explorerLinks: Url[]
  receipts: TransactionReceipt[]
}

/**
 * Waits for a super transaction receipt to be available
 * @param client - The Mee client to use
 * @param params - The parameters for the super transaction
 * @returns The receipt of the super transaction
 * @example
 * const receipt = await waitForSupertransactionReceipt(client, {
 *   hash: "0x..."
 * })
 */
export const waitForSupertransactionReceipt = async (
  client: BaseMeeClient,
  params: WaitForSupertransactionReceiptParams
): Promise<WaitForSupertransactionReceiptPayload> => {
  const account = client.account
  const wait = params.wait ?? true

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

  if (userOpError || errorFromExecutionData || statusError) {
    throw new Error(
      [
        userOpError?.chainId,
        userOpError?.executionError ||
          errorFromExecutionData?.executionData ||
          "Unknown error"
      ].join(" - ")
    )
  }

  const statusPending = statuses.some((status) => status === "PENDING")
  if (statusPending) {
    await new Promise((resolve) => setTimeout(resolve, pollingInterval))
    return await getAction(
      client as AnyData,
      waitForSupertransactionReceipt,
      "waitForSupertransactionReceipt"
    )(params)
  }

  const receipts = wait
    ? await Promise.all(
        explorerResponse.userOps.map(({ chainId, executionData }) =>
          waitForTransactionReceipt(
            account.deploymentOn(Number(chainId), true).publicClient,
            {
              hash: executionData
            }
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
