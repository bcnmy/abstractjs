import type { BaseMeeClient } from "../../createMeeClient"
import execute from "./execute"
import executeQuote from "./executeQuote"
import executeSignedQuote, {
  type ExecuteSignedQuoteParams,
  type ExecuteSignedQuotePayload
} from "./executeSignedQuote"
import getFusionQuote, {
  type GetFusionQuoteParams,
  type GetFusionQuotePayload
} from "./getFusionQuote"
import {
  type GetGasTokenParams,
  type GetGasTokenPayload,
  getGasToken
} from "./getGasToken"
import getOnChainQuote, {
  type GetOnChainQuoteParams,
  type GetOnChainQuotePayload
} from "./getOnChainQuote.js"
import {
  type GetPaymentTokenParams,
  type GetPaymentTokenPayload,
  getPaymentToken
} from "./getPaymentToken"
import getPermitQuote, {
  type GetPermitQuoteParams,
  type GetPermitQuotePayload
} from "./getPermitQuote"
import { type GetQuoteParams, type GetQuotePayload, getQuote } from "./getQuote"
import signFusionQuote, {
  type SignFusionQuotePayload,
  type SignFusionQuoteParameters
} from "./signFusionQuote"
import signOnChainQuote, {
  type SignOnChainQuoteParams,
  type SignOnChainQuotePayload
} from "./signOnChainQuote.js"
import signPermitQuote, {
  type SignPermitQuoteParams,
  type SignPermitQuotePayload
} from "./signPermitQuote"
import signQuote, {
  type SignQuotePayload,
  type SignQuoteParams
} from "./signQuote"
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
   * @param: {@link SignOnChainQuoteParams}
   * @returns: {@link SignOnChainQuotePayload}
   * @example
   * ```typescript
   * const signedQuote = await meeClient.signOnChainQuote({
   *   quote: quote,
   *   executionMode: "direct-to-mee"
   * })
   * ```
   */

  signOnChainQuote: (
    params: SignOnChainQuoteParams
  ) => Promise<SignOnChainQuotePayload>

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
    params: SignPermitQuoteParams
  ) => Promise<SignPermitQuotePayload>

  /**
   * Get a permit quote for executing a set of instructions
   * @param params: {@link GetPermitQuoteParams}
   * @returns: {@link GetPermitQuotePayload}
   */
  getPermitQuote: (
    params: GetPermitQuoteParams
  ) => Promise<GetPermitQuotePayload>

  /**
   * Get a gas token for a specific chain
   * @param params: {@link GetGasTokenParams}
   * @returns: {@link GetGasTokenPayload}
   */
  getGasToken: (params: GetGasTokenParams) => Promise<GetGasTokenPayload>

  /**
   * Get a payment token for a specific chain
   * @param params: {@link GetPaymentTokenParams}
   * @returns: {@link GetPaymentTokenPayload}
   */
  getPaymentToken: <EParams extends GetPaymentTokenParams>(
    params: EParams
  ) => Promise<GetPaymentTokenPayload>

  /**
   * Get a quote on chain
   * @param params: {@link GetOnChainQuoteParams}
   * @returns: {@link GetOnChainQuotePayload}
   */
  getOnChainQuote: (
    params: GetOnChainQuoteParams
  ) => Promise<GetOnChainQuotePayload>

  /**
   * Get a fusion quote for executing a set of instructions
   * @param params: {@link GetFusionQuoteParams}
   * @returns: {@link GetFusionQuotePayload}
   */
  getFusionQuote: (
    params: GetFusionQuoteParams
  ) => Promise<GetFusionQuotePayload>

  /**
   * Sign a fusion quote
   * @param params: {@link SignFusionQuoteParams}
   * @returns: {@link SignFusionQuotePayload}
   */
  signFusionQuote: (
    params: SignFusionQuoteParameters
  ) => Promise<SignFusionQuotePayload>
}

export const meeActions = (meeClient: BaseMeeClient): MeeActions => {
  return {
    getGasToken: (params: GetGasTokenParams) => getGasToken(meeClient, params),
    getPaymentToken: (params: GetPaymentTokenParams) =>
      getPaymentToken(meeClient, params),
    getOnChainQuote: (params: GetOnChainQuoteParams) =>
      getOnChainQuote(meeClient, params),
    getQuote: (params: GetQuoteParams) => getQuote(meeClient, params),
    signQuote: (params: SignQuoteParams) => signQuote(meeClient, params),
    executeSignedQuote: (params: ExecuteSignedQuoteParams) =>
      executeSignedQuote(meeClient, params),
    execute: (params: GetQuoteParams) => execute(meeClient, params),
    executeQuote: (params: SignQuoteParams) => executeQuote(meeClient, params),
    waitForSupertransactionReceipt: (
      params: WaitForSupertransactionReceiptParams
    ) => waitForSupertransactionReceipt(meeClient, params),
    signOnChainQuote: (params: SignOnChainQuoteParams) =>
      signOnChainQuote(meeClient, params),
    signPermitQuote: (params: SignPermitQuoteParams) =>
      signPermitQuote(meeClient, params),
    getPermitQuote: (params: GetPermitQuoteParams) =>
      getPermitQuote(meeClient, params),
    getFusionQuote: (params: GetFusionQuoteParams) =>
      getFusionQuote(meeClient, params),
    signFusionQuote: (params: SignFusionQuoteParameters) =>
      signFusionQuote(meeClient, params)
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
export * from "./signOnChainQuote"
export * from "./signFusionQuote"
export * from "./getOnChainQuote"
export * from "./getFusionQuote"
export * from "./signFusionQuote"
export * from "./getPermitQuote"
