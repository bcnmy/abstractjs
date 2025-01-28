import { isHex, type Hex } from "viem"
import {
  getExplorerTxLink,
  getJiffyScanLink,
  getMeeScanLink
} from "../../../account/utils/explorer"
import type { Url } from "../../createHttpClient"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"
import { getAction } from "viem/utils"

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
  executionStatus: "SUCCESS" | "PENDING"
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

  if (userOpError || errorFromExecutionData) {
    throw new Error(
      [
        userOpError?.chainId,
        userOpError?.executionError || errorFromExecutionData?.executionData
      ].join(" - ")
    )
  }

  const statuses = explorerResponse.userOps.map(
    (userOp) => userOp.executionStatus
  )

  const statusPending = statuses.some((status) => status === "PENDING")
  if (statusPending) {
    await new Promise((resolve) =>
      setTimeout(resolve, client.pollingInterval ?? 1000)
    )
    return await getAction(
      client as any,
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
