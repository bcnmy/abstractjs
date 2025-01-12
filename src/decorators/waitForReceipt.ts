import type { Hex } from "viem"
import type { BaseMeeClient } from "../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"
import {
  getExplorerTxLink,
  getJiffyScanLink,
  getMeeScanLink
} from "../utils/explorer/explorer"
import type { Url } from "../utils/clients/createHttpClient"

/**
 * Parameters required for requesting a quote from the MEE service
 * @type WaitForReceiptParams
 */
export type WaitForReceiptParams = {
  /** The hash of the super transaction */
  hash: Hex
}

/**
 * Explorer links for each chain
 * @type ExplorerLinks
 */
type ExplorerLinks = { meeScan: Url } & {
  [chainId: string]: {
    txHash: Url
    jiffyScan: Url
  }
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
 * The payload returned by the waitForReceipt function
 * @type WaitForReceiptPayload
 */
export type WaitForReceiptPayload = Omit<GetQuotePayload, "userOps"> & {
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
  explorerLinks: ExplorerLinks
}

/**
 * Waits for a super transaction receipt to be available
 * @param client - The Mee client to use
 * @param params - The parameters for the super transaction
 * @returns The receipt of the super transaction
 * @example
 * const receipt = await waitForReceipt(client, {
 *   hash: "0x..."
 * })
 */
export const waitForReceipt = async (
  client: BaseMeeClient,
  params: WaitForReceiptParams
): Promise<WaitForReceiptPayload> => {
  const fireRequest = async () =>
    await client.request<WaitForReceiptPayload>({
      path: `v1/explorer/${params.hash}`,
      method: "GET"
    })

  const waitForReceipt = async () => {
    const explorerResponse = await fireRequest()

    const userOpError = explorerResponse.userOps.find(
      (userOp) => userOp.executionError
    )
    if (userOpError) {
      throw new Error(userOpError.executionError)
    }

    const statuses = explorerResponse.userOps.map(
      (userOp) => userOp.executionStatus
    )

    const statusPending = statuses.some((status) => status === "PENDING")
    if (statusPending) {
      await new Promise((resolve) =>
        setTimeout(resolve, client.pollingInterval)
      )
      return await waitForReceipt()
    }

    const explorerLinks = explorerResponse.userOps.reduce(
      (acc, userOp) => {
        acc[userOp.chainId] = {
          txHash: getExplorerTxLink(userOp.executionData, userOp.chainId),
          jiffyScan: getJiffyScanLink(userOp.userOpHash)
        }
        return acc
      },
      {
        meeScan: getMeeScanLink(params.hash)
      } as ExplorerLinks
    )

    return { ...explorerResponse, explorerLinks }
  }

  return await waitForReceipt()
}

export default waitForReceipt
