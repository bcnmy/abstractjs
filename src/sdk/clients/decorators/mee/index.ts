import type { BaseMeeClient } from "../../createMeeClient"
import execute from "./execute"
import {
  type ExecuteFusionQuoteParams,
  type ExecuteFusionQuotePayload,
  executeFusionQuote
} from "./executeFusionQuote"
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

/**
 * Collection of MEE (Multi-chain Execution Environment) actions for transaction handling
 */
export type MeeActions = {
  /**
   * Get a quote for executing a set of instructions
   * @param params - Parameters for generating the quote
   * @param params.instructions - Array of transaction instructions to execute
   * @param params.feeToken - Token to use for gas payment
   * @returns Promise resolving to quote information
   * @throws Error if the account is not deployed on any required chain
   *
   * @example
   * ```typescript
   * const quote = await meeClient.getQuote({
   *   instructions: [{
   *     to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
   *     data: "0x...",
   *     value: "0"
   *   }],
   *   feeToken: {
   *     address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
   *     chainId: 1
   *   }
   * });
   * ```
   */
  getQuote: (params: GetQuoteParams) => Promise<GetQuotePayload>

  /**
   * Sign a quote for executing a set of instructions
   * @param params - Parameters for signing the quote
   * @param params.quote - Quote to sign
   * @returns Promise resolving to signed quote data
   *
   * @example
   * ```typescript
   * const signedQuote = await meeClient.signQuote({
   *   quote: quote
   * });
   * ```
   */
  signQuote: (params: SignQuoteParams) => Promise<SignQuotePayload>

  /**
   * Execute a previously signed quote
   * @param params - Parameters for executing the signed quote
   * @param params.signedQuote - The signed quote to execute
   * @returns Promise resolving to transaction hash
   *
   * @example
   * ```typescript
   * const result = await meeClient.executeSignedQuote({
   *   signedQuote: signedQuote
   * });
   * ```
   */
  executeSignedQuote: (
    params: ExecuteSignedQuoteParams
  ) => Promise<ExecuteSignedQuotePayload>

  /**
   * Convenience method that combines getQuote, signQuote, and executeSignedQuote
   * into a single operation
   * @param params - Parameters for generating and executing the quote
   * @returns Promise resolving to transaction hash
   *
   * @example
   * ```typescript
   * const result = await meeClient.execute({
   *   instructions: [{
   *     to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
   *     data: "0x...",
   *     value: "0"
   *   }],
   *   feeToken: {
   *     address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
   *     chainId: 1
   *   }
   * });
   * ```
   */
  execute: (params: GetQuoteParams) => Promise<ExecuteSignedQuotePayload>

  /**
   * Execute a quote by signing and executing it
   * @param params - Parameters for signing and executing the quote
   * @returns Promise resolving to transaction hash
   *
   * @example
   * ```typescript
   * const result = await meeClient.executeQuote({
   *   quote: quote
   * });
   * ```
   */
  executeQuote: (params: SignQuoteParams) => Promise<ExecuteSignedQuotePayload>

  /**
   * Wait for a supertransaction receipt to be available
   * @param params - Parameters for retrieving the receipt
   * @param params.hash - Transaction hash to wait for
   * @returns Promise resolving to transaction receipt
   *
   * @example
   * ```typescript
   * const receipt = await meeClient.waitForSupertransactionReceipt({
   *   hash: "0x123..."
   * });
   * ```
   */
  waitForSupertransactionReceipt: (
    params: WaitForSupertransactionReceiptParams
  ) => Promise<WaitForSupertransactionReceiptPayload>

  /**
   * Sign an on-chain quote for standard transactions
   * @param params - Parameters for signing the on-chain quote
   * @returns Promise resolving to signed quote data
   */
  signOnChainQuote: (
    params: SignOnChainQuoteParams
  ) => Promise<SignOnChainQuotePayload>

  /**
   * Sign a permit quote for ERC20Permit-enabled tokens
   * @param params - Parameters for signing the permit quote
   * @returns Promise resolving to signed permit data
   */
  signPermitQuote: (
    params: SignPermitQuoteParams
  ) => Promise<SignPermitQuotePayload>

  /**
   * Get a permit quote for ERC20Permit-enabled tokens
   * @param params - Parameters for generating the permit quote
   * @returns Promise resolving to permit quote data
   */
  getPermitQuote: (
    params: GetPermitQuoteParams
  ) => Promise<GetPermitQuotePayload>

  /**
   * Get gas token information for a specific chain
   * @param params - Parameters for retrieving gas token info
   * @returns Promise resolving to gas token data
   */
  getGasToken: (params: GetGasTokenParams) => Promise<GetGasTokenPayload>

  /**
   * Get payment token information for a specific chain
   * @param params - Parameters for retrieving payment token info
   * @returns Promise resolving to payment token data
   */
  getPaymentToken: <EParams extends GetPaymentTokenParams>(
    params: EParams
  ) => Promise<GetPaymentTokenPayload>

  /**
   * Get an on-chain quote for standard transactions
   * @param params - Parameters for generating the on-chain quote
   * @returns Promise resolving to on-chain quote data
   */
  getOnChainQuote: (
    params: GetOnChainQuoteParams
  ) => Promise<GetOnChainQuotePayload>

  /**
   * Get a fusion quote that automatically selects between permit and on-chain
   * @param params - Parameters for generating the fusion quote
   * @returns Promise resolving to fusion quote data
   */
  getFusionQuote: (
    params: GetFusionQuoteParams
  ) => Promise<GetFusionQuotePayload>

  /**
   * Sign a fusion quote
   * @param params - Parameters for signing the fusion quote
   * @returns Promise resolving to signed fusion quote data
   */
  signFusionQuote: (
    params: SignFusionQuoteParameters
  ) => Promise<SignFusionQuotePayload>

  /**
   * Execute a fusion quote
   * @param params - Parameters for executing the fusion quote
   * @returns Promise resolving to transaction hash
   */
  executeFusionQuote: (
    params: ExecuteFusionQuoteParams
  ) => Promise<ExecuteFusionQuotePayload>
}

/**
 * Creates an instance of MEE actions using the provided client
 * @param meeClient - Base MEE client instance
 * @returns Object containing all MEE actions
 */
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
      signFusionQuote(meeClient, params),
    executeFusionQuote: (params: SignFusionQuoteParameters) =>
      executeFusionQuote(meeClient, params)
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
export * from "./executeFusionQuote"
