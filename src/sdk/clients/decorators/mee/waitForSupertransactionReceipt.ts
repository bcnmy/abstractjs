import { type Hex, isHex } from "viem"
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

  return { ...explorerResponse, explorerLinks }
}

export default waitForSupertransactionReceipt
