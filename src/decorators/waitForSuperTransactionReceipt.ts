import type { Hex } from "viem"
import type { MultichainSmartAccount } from "../account-vendors"
import type { BaseMeeClient } from "../createMeeClient"
import type {
  GetQuotePayload,
  MeeFilledUserOp,
  MeeFilledUserOpDetails
} from "./getQuote"
import { getExplorerTxLink } from "../utils/explorer/explorer"

/**
 * Parameters required for requesting a quote from the MEE service
 * @type WaitForSuperTransactionReceiptParams
 */
export type WaitForSuperTransactionReceiptParams = {
  /** The hash of the super transaction */
  hash: Hex
}

/**
 * Explorer links for each chain
 * @type ExplorerLinks
 */
type ExplorerLinks = {
  explorerLinks: {
    meeScan: string
    [chainId: string]: string
  }
}

/**
 * The status of a user operation
 * @type UserOpStatus
 */
type UserOpStatus = {
  executionStatus: "SUCCESS" | "PENDING"
  executionData: string
  executionError: string
}
/**
 * The payload returned by the waitForSuperTransactionReceipt function
 * @type WaitForSuperTransactionReceiptPayload
 */
export type WaitForSuperTransactionReceiptPayload = Omit<
  GetQuotePayload,
  "userOps"
> &
  ExplorerLinks & {
    userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
  }

/**
 * Waits for a super transaction receipt to be available
 * @param client - The Mee client to use
 * @param params - The parameters for the super transaction
 * @returns The receipt of the super transaction
 * @example
 * const receipt = await waitForSuperTransactionReceipt(client, {
 *   hash: "0x..."
 * })
 */
export const waitForSuperTransactionReceipt = async (
  client: BaseMeeClient,
  params: WaitForSuperTransactionReceiptParams
): Promise<WaitForSuperTransactionReceiptPayload> => {
  const fireRequest = async () =>
    await client.request<WaitForSuperTransactionReceiptPayload>({
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
        acc[userOp.chainId] = getExplorerTxLink(params.hash, userOp.chainId)
        return acc
      },
      {
        meeScan: getExplorerTxLink(params.hash)
      } as ExplorerLinks["explorerLinks"]
    )

    return { ...explorerResponse, explorerLinks }
  }

  return await waitForReceipt()
}

export default waitForSuperTransactionReceipt
