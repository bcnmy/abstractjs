import { addressEquals } from "../../../account"
import type { BaseMeeClient } from "../../createMeeClient"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"

export type GetFusionQuotePayload = GetQuotePayload
export type GetFusionQuoteParams = GetQuoteParams

const PERMIT_PARAMS: Partial<GetQuoteParams> = {
  permitMode: true,
  walletProvider: "BICO_V2_EOA"
}

/**
 * Get a fusion quote from the MEE service
 * @param client - The base MEE client
 * @param params - The parameters for the quote request
 * @returns The quote payload
 * @throws If the token does not support ERC20Permit
 *
 * @example
 * ```ts
 * const quote = await getFusionQuote(meeClient, {
 *   instructions: [
 *     mcNexus.build({
 *       type: "default",
 *       data: {
 *         calls: [
 *           { to: "0x0000000000000000000000000000000000000000", gasLimit: 50000n, value: 0n }
 *         ],
 *         chainId: targetChain.id
 *       }
 *     })
 *   ],
 *   feeToken
 * })
 * ```
 */
export const getFusionQuote = async (
  client: BaseMeeClient,
  params: GetFusionQuoteParams
): Promise<GetFusionQuotePayload> => {
  const { permitMode = true, ...rest } = params

  return await getQuote(client, {
    ...(permitMode ? PERMIT_PARAMS : {}),
    ...rest
  })
}

export default getFusionQuote
