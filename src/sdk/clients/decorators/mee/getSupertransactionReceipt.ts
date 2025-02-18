import {
  type GetTransactionReceiptParameters,
  type Hex,
  type TransactionReceipt,
  isHex
} from "viem"
import { getTransactionReceipt as getTransactionReceiptFromViem } from "viem/actions"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import {
  getExplorerTxLink,
  getJiffyScanLink,
  getMeeScanLink
} from "../../../account/utils/explorer"
import { parseErrorMessage } from "../../../account/utils/parseErrorMessage"
import { parseTransactionStatus } from "../../../account/utils/parseTransactionStatus"
import type { Url } from "../../createHttpClient"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"

/**
 * Parameters for waiting for a supertransaction receipt
 */
export type GetSupertransactionReceiptParams =
  GetTransactionReceiptParameters & {
    /** The number of confirmations to wait for. Defaults to 2. */
    confirmations?: number
    /**
     * Optional smart account to execute the transaction.
     * If not provided, uses the client's default account
     */
    account?: MultichainSmartAccount
  }

/**
 * The status of a user operation
 * @type UserOpStatus
 */
export type UserOpStatus = {
  executionStatus: "SUCCESS" | "PENDING" | "ERROR"
  executionData: Hex
  executionError: string
}

/**
 * Response payload containing the supertransaction receipt details
 */
export type GetSupertransactionReceiptPayload = Omit<
  GetQuotePayload,
  "userOps"
> & {
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
  explorerLinks: Url[]
  receipts: PromiseSettledResult<TransactionReceipt>[]
  /**
   * The transaction hash
   * @example "0x123..."
   */
  hash: Hex
  /**
   * Status of the transaction
   * @example "success"
   */
  transactionStatus: string
}

export const getSupertransactionReceipt = async (
  client: BaseMeeClient,
  parameters: GetSupertransactionReceiptParams
): Promise<GetSupertransactionReceiptPayload> => {
  const { confirmations = 2, ...params } = parameters
  const account = parameters.account ?? client.account

  const explorerResponse =
    await client.request<GetSupertransactionReceiptPayload>({
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

  const receipts = await Promise.allSettled(
    explorerResponse.userOps.map(({ chainId, executionData }) =>
      executionData
        ? getTransactionReceiptFromViem(
            account.deploymentOn(Number(chainId), true).publicClient,
            { confirmations, ...parameters, hash: executionData }
          )
        : Promise.reject(new Error("No execution data"))
    )
  )

  const transactionStatus = await parseTransactionStatus(
    explorerResponse.userOps,
    receipts
  )

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

  return {
    ...explorerResponse,
    explorerLinks,
    receipts,
    transactionStatus
  }
}

export default getSupertransactionReceipt
