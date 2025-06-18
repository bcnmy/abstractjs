import {
  type GetTransactionReceiptParameters,
  type Hex,
  type TransactionReceipt,
  formatTransactionReceipt
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
import type { AnyData } from "../../../modules"
import { type Url, createHttpClient } from "../../createHttpClient"
import {
  type BaseMeeClient,
  DEFAULT_PATHFINDER_URL
} from "../../createMeeClient"
import type { GetQuotePayload, MeeFilledUserOpDetails } from "./getQuote"

/**
 * Parameters for waiting for a supertransaction receipt
 */
export type GetSupertransactionReceiptParams =
  GetTransactionReceiptParameters & {
    /** Whether to wait for receipts to be mined. Defaults to true. */
    waitForReceipts?: boolean
    /** The number of confirmations to wait for. Defaults to 2. Only used if waitForReceipts is true. */
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
  executionStatus:
    | "SUCCESS"
    | "MINING"
    | "MINED_SUCCESS"
    | "MINED_FAIL"
    | "FAILED"
    | "PENDING"
  executionData: Hex
  executionError: string
}

/**
 * Base response payload containing common supertransaction receipt details
 */
export type BaseGetSupertransactionReceiptPayload = Omit<
  GetQuotePayload,
  "userOps"
> & {
  userOps: (MeeFilledUserOpDetails & UserOpStatus)[]
  explorerLinks: Url[]
  /**
   * The transaction hash
   * @example "0x123..."
   */
  hash: Hex
  /**
   * Status of the transaction
   * @example "FAILED"
   */
  transactionStatus: UserOpStatus["executionStatus"]
}

/**
 * Response payload with receipts (when waitForReceipts is true)
 */
export type GetSupertransactionReceiptPayloadWithReceipts =
  BaseGetSupertransactionReceiptPayload & {
    receipts: TransactionReceipt[]
  }

/**
 * Response payload without receipts (when waitForReceipts is false)
 */
export type GetSupertransactionReceiptPayloadWithoutReceipts =
  BaseGetSupertransactionReceiptPayload & {
    receipts: null
  }

/**
 * Combined response payload type that conditionally includes receipts based on waitForReceipts
 */
export type GetSupertransactionReceiptPayload =
  | GetSupertransactionReceiptPayloadWithReceipts
  | GetSupertransactionReceiptPayloadWithoutReceipts

/**
 * Get a supertransaction receipt from the MEE node
 *
 * @typeParam T - Type of the return value, determined by waitForReceipts parameter
 * @param client - The Mee client instance
 * @param parameters - Parameters for retrieving the receipt
 * @returns Promise resolving to the supertransaction receipt, with or without chain receipts depending on waitForReceipts
 */
export function getSupertransactionReceipt<T extends boolean = true>(
  client: BaseMeeClient,
  parameters: GetSupertransactionReceiptParams & { waitForReceipts?: T }
): Promise<
  T extends true
    ? GetSupertransactionReceiptPayloadWithReceipts
    : GetSupertransactionReceiptPayloadWithoutReceipts
>

export async function getSupertransactionReceipt(
  client: BaseMeeClient,
  parameters: GetSupertransactionReceiptParams
): Promise<GetSupertransactionReceiptPayload> {
  const { confirmations = 2, waitForReceipts = true, ...params } = parameters
  const account = parameters.account ?? client.account

  // We will collect all receipts only after happy path
  let receipts: TransactionReceipt[] | null = null

  const explorerResponse =
    await client.request<BaseGetSupertransactionReceiptPayload>({
      path: `explorer/${params.hash}`,
      method: "GET"
    })

  const metaStatus = await parseTransactionStatus(explorerResponse.userOps)
  switch (metaStatus.status) {
    case "FAILED": {
      console.log({ metaStatus, explorerResponse, hash: params.hash })
      throw new Error(parseErrorMessage(metaStatus.message))
    }
    case "MINED_FAIL": {
      console.log({ metaStatus, explorerResponse, hash: params.hash })
      throw new Error(parseErrorMessage(metaStatus.message))
    }
    case "PENDING": {
      break
    }
    case "MINING": {
      break
    }
    case "MINED_SUCCESS": {
      if (waitForReceipts) {
        const isSponsoredSupertransaction =
          explorerResponse.paymentInfo.sponsored
        const sponsorshipUrl =
          explorerResponse.paymentInfo.sponsorshipUrl || DEFAULT_PATHFINDER_URL

        receipts = await Promise.all(
          explorerResponse.userOps
            .filter((userOp) => {
              if (
                userOp.isCleanUpUserOp &&
                userOp.executionStatus !== "MINED_SUCCESS"
              ) {
                return false
              }

              return true
            })
            .map(async ({ chainId, executionData }, index) => {
              // If sponsored tx ? the receipt for sponsored payment userOp needs to be fetched from
              // sponsorship backend
              if (isSponsoredSupertransaction && index === 0) {
                const sponsorshipClient = createHttpClient(sponsorshipUrl)

                const receipt = await sponsorshipClient.request({
                  path: `sponsorship/receipt/${chainId}/${executionData}`,
                  method: "GET"
                })

                return formatTransactionReceipt(receipt as AnyData)
              }

              return getTransactionReceiptFromViem(
                account.deploymentOn(Number(chainId), true).publicClient,
                {
                  confirmations,
                  ...parameters,
                  hash: executionData
                }
              )
            })
        )
      }
      break
    }
    default: {
      throw new Error("Unknown transaction status")
    }
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

  return {
    ...explorerResponse,
    explorerLinks,
    receipts,
    transactionStatus: metaStatus.status
  } as GetSupertransactionReceiptPayload
}

export default getSupertransactionReceipt
