import type { BaseMeeClient } from "../createMeeClient"
import { getQuote, type GetQuotePayload, type GetQuoteParams } from "./getQuote"
import signQuote, {
  type SignQuotePayload,
  type SignQuoteParams
} from "./signQuote"
import executeSignedQuote, {
  type ExecuteSignedQuoteParams,
  type ExecuteSignedQuotePayload
} from "./executeSignedQuote"
import execute from "./execute"
import executeQuote from "./executeQuote"
import waitForSuperTransactionReceipt, {
  type WaitForSuperTransactionReceiptParams,
  type WaitForSuperTransactionReceiptPayload
} from "./waitForSuperTransactionReceipt"
import signFusionQuote, {
  type SignFusionQuoteParams,
  type SignFusionQuotePayload
} from "./signFusionQuote"
import executeSignedFusionQuote, {
  type ExecuteSignedFusionQuoteParams,
  type ExecuteSignedFusionQuotePayload
} from "./executeSignedFusionQuote"

export type MeeActions = {
  /**
   * Get a quote for executing a set of instructions
   * @param params - {@link GetQuoteParams}
   * @returns: {@link GetQuotePayload}
   * @throws Error if the account is not deployed on any required chain
   * @example
   * ```typescript
   * const quote = await meeClient.getQuote({
   *   superTransaction: [...],
   *   feeToken: {
   *     address: '0x...',
   *     chainId: 1
   *   }
   * })
   * ```
   */
  getQuote: (params: GetQuoteParams) => Promise<GetQuotePayload>

  /**
   * Sign a quote for executing a set of instructions
   * @param: {@link SignQuoteParams}
   * @returns: {@link SignQuotePayload}
   * @example
   * ```typescript
   * const SignQuotePayload = await meeClient.signQuote({
   *   quote: quote,
   *   executionMode: "direct-to-mee"
   * })
   * ```
   */
  signQuote: (params: SignQuoteParams) => Promise<SignQuotePayload>

  /**
   * Execute a signed quote
   * @param: {@link ExecuteSignedQuoteParams}
   * @returns: {@link ExecuteSignedQuotePayload}
   * @example
   * ```typescript
   * const hash = await meeClient.executeSignedQuote({
   *   signedQuote: {
   *     ...
   *   }
   * })
   * ```
   */
  executeSignedQuote: (
    params: ExecuteSignedQuoteParams
  ) => Promise<ExecuteSignedQuotePayload>
  /**
   * Execute a quote by fetching it, signing it, and then executing the signed quote.
   * @param: {@link GetQuoteParams}
   * @returns: {@link ExecuteSignedQuotePayload}
   * @example
   * ```typescript
   * const hash = await meeClient.execute({
   *   superTransaction: [...],
   *   feeToken: {
   *     address: '0x...',
   *     chainId: 1
   *   }
   * })
   * ```
   */
  execute: (params: GetQuoteParams) => Promise<ExecuteSignedQuotePayload>

  /**
   * Execute a quote by fetching it, signing it, and then executing the signed quote.
   * @param: {@link GetQuoteParams}
   * @returns: {@link ExecuteSignedQuotePayload}
   * @example
   * ```typescript
   * const hash = await meeClient.executeQuote({
   *   superTransaction: [...],
   *   feeToken: {
   *     address: '0x...',
   *     chainId: 1
   *   }
   * })
   * ```
   */
  executeQuote: (params: SignQuoteParams) => Promise<ExecuteSignedQuotePayload>

  /**
   * Wait for a super transaction receipt to be available
   * @param: {@link WaitForSuperTransactionReceiptParams}
   * @returns: {@link WaitForSuperTransactionReceiptPayload}
   * @example
   * ```typescript
   * const receipt = await meeClient.waitForSuperTransactionReceipt({
   *   hash: "0x..."
   * })
   * ```
   */
  waitForSuperTransactionReceipt: (
    params: WaitForSuperTransactionReceiptParams
  ) => Promise<WaitForSuperTransactionReceiptPayload>
  /**
   * Sign a fusion quote
   * @param: {@link SignFusionQuoteParams}
   * @returns: {@link SignFusionQuotePayload}
   * @example
   * ```typescript
   * const signedQuote = await meeClient.signFusionQuote({
   *   quote: quote,
   *   executionMode: "direct-to-mee"
   * })
   * ```
   */
  signFusionQuote: (
    params: SignFusionQuoteParams
  ) => Promise<SignFusionQuotePayload>

  /**
   * Execute a signed fusion quote
   * @param: {@link ExecuteSignedFusionQuoteParams}
   * @returns: {@link ExecuteSignedFusionQuotePayload}
   * @example
   * ```typescript
   * const hash = await meeClient.executeSignedFusionQuote({
   *   signedFusionQuote: {
   *     ...
   *   }
   * })
   * ```
   */
  executeSignedFusionQuote: (
    params: ExecuteSignedFusionQuoteParams
  ) => Promise<ExecuteSignedFusionQuotePayload>
}

export const meeActions = (meeClient: BaseMeeClient): MeeActions => {
  return {
    getQuote: (params: GetQuoteParams) => getQuote(meeClient, params),
    signQuote: (params: SignQuoteParams) => signQuote(meeClient, params),
    executeSignedQuote: (params: ExecuteSignedQuoteParams) =>
      executeSignedQuote(meeClient, params),
    execute: (params: GetQuoteParams) => execute(meeClient, params),
    executeQuote: (params: SignQuoteParams) => executeQuote(meeClient, params),
    waitForSuperTransactionReceipt: (
      params: WaitForSuperTransactionReceiptParams
    ) => waitForSuperTransactionReceipt(meeClient, params),
    signFusionQuote: (params: SignFusionQuoteParams) =>
      signFusionQuote(meeClient, params),
    executeSignedFusionQuote: (params: ExecuteSignedFusionQuoteParams) =>
      executeSignedFusionQuote(meeClient, params)
  }
}

export * from "./getQuote"
export * from "./signFusionQuote"
export * from "./executeSignedFusionQuote"
export * from "./waitForSuperTransactionReceipt"
export * from "./signQuote"
export * from "./executeSignedQuote"
export * from "./execute"
export * from "./executeQuote"
