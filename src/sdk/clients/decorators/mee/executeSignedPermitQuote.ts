import type { Hex, TransactionReceipt } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"
import type { ExecuteSignedQuotePayload } from "./executeSignedQuote"
import type { SignPermitQuotePayload } from "./signPermitQuote"

export type ExecuteSignedPermitQuoteParams = {
  /** Quote to be executed */
  signedPermitQuote: SignPermitQuotePayload
}

export type ExecuteSignedPermitQuotePayload = {
  /** Hash of the executed Supertransaction */
  hash: Hex
  /** Transaction receipt */
  receipt: TransactionReceipt
}

/**
 * Executes a signed quote.
 * @param client - The Mee client to use
 * @param params - The parameters for executing the signed quote
 * @returns The hash of the executed transaction
 * @example
 * const hash = await executeSignedPermitQuote(client, {
 *   signedPermitQuote: {
 *     ...
 *   }
 * })
 */
export const executeSignedPermitQuote = async (
  client: BaseMeeClient,
  params: ExecuteSignedPermitQuoteParams
): Promise<ExecuteSignedPermitQuotePayload> => {
  const signedPermitQuote = params.signedPermitQuote

  const { hash } = await client.request<ExecuteSignedQuotePayload>({
    path: "v1/exec",
    body: signedPermitQuote
  })

  return {
    hash,
    receipt: {} as TransactionReceipt
  }
}

export default executeSignedPermitQuote
