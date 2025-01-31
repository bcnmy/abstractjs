import type { BaseMeeClient } from "../../createMeeClient"
import execute from "./execute"
import executeQuote from "./executeQuote"
import executeSignedQuote, {
  type ExecuteSignedQuoteParams,
  type ExecuteSignedQuotePayload
} from "./executeSignedQuote"
import { type GetQuoteParams, type GetQuotePayload, getQuote } from "./getQuote"
import signPermitQuote, {
  type SignFusionQuoteParams,
  type SignPermitQuotePayload
} from "./signPermitQuote"
import signQuote, {
  type SignQuotePayload,
  type SignQuoteParams
} from "./signQuote"
import signQuoteOnChain, {
  type SignQuoteOnChainPayload
} from "./signQuoteOnChain"
import waitForSupertransactionReceipt, {
  type WaitForSupertransactionReceiptParams,
  type WaitForSupertransactionReceiptPayload
} from "./waitForSupertransactionReceipt"

export type MeeActions = {
  /**
   * Get a quote for executing a set of instructions
   * @param params - {@link GetQuoteParams}
   * @returns: {@link GetQuotePayload}
   * @throws Error if the account is not deployed on any required chain
   * @example
   * ```typescript
   * const quote = await meeClient.getQuote({
   *   instructions: [...],
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
   *   instructions: [...],
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
   *   instructions: [...],
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
   * @param: {@link WaitForSupertransactionReceiptParams}
   * @returns: {@link WaitForSupertransactionReceiptPayload}
   * @example
   * ```typescript
   * const receipt = await meeClient.waitForSupertransactionReceipt({
   *   hash: "0x..."
   * })
   * ```
   */
  waitForSupertransactionReceipt: (
    params: WaitForSupertransactionReceiptParams
  ) => Promise<WaitForSupertransactionReceiptPayload>
  /**
   * Sign a fusion quote
   * @param: {@link SignQuoteOnChainParams}
   * @returns: {@link SignQuoteOnChainPayload}
   * @example
   * ```typescript
   * const signedQuote = await meeClient.signQuoteOnChain({
   *   quote: quote,
   *   executionMode: "direct-to-mee"
   * })
   * ```
   */
  signQuoteOnChain: (
    params: SignFusionQuoteParams
  ) => Promise<SignQuoteOnChainPayload>

  /**
   * Sign a quote on chain
   * @param: {@link SignPermitQuoteParams}
   * @returns: {@link SignPermitQuotePayload}
   * @example
   * ```typescript
   * const signedQuote = await meeClient.signPermitQuote({
   *   quote: quote,
   *   executionMode: "direct-to-mee"
   * })
   * ```
   */
  signPermitQuote: (
    params: SignFusionQuoteParams
  ) => Promise<SignPermitQuotePayload>
}

export const meeActions = (meeClient: BaseMeeClient): MeeActions => {
  return {
    getQuote: (params: GetQuoteParams) => getQuote(meeClient, params),
    signQuote: (params: SignQuoteParams) => signQuote(meeClient, params),
    executeSignedQuote: (params: ExecuteSignedQuoteParams) =>
      executeSignedQuote(meeClient, params),
    execute: (params: GetQuoteParams) => execute(meeClient, params),
    executeQuote: (params: SignQuoteParams) => executeQuote(meeClient, params),
    waitForSupertransactionReceipt: (
      params: WaitForSupertransactionReceiptParams
    ) => waitForSupertransactionReceipt(meeClient, params),
    signQuoteOnChain: (params: SignFusionQuoteParams) =>
      signQuoteOnChain(meeClient, params),
    signPermitQuote: (params: SignFusionQuoteParams) =>
      signPermitQuote(meeClient, params)
  }
}
export * from "./getQuote"
export * from "./executeSignedQuote"
export * from "./signQuote"
export * from "./executeSignedQuote"
export * from "./execute"
export * from "./executeQuote"
export * from "./waitForSupertransactionReceipt"
export * from "./getInfo"
export * from "./signPermitQuote"
export * from "./signQuoteOnChain"
