import type { BaseMeeClient } from "../../createMeeClient"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"

export type GetPermitQuotePayload = GetQuotePayload
export type GetPermitQuoteParams = Omit<
  GetQuoteParams,
  "permitMode" | "walletProvider"
>

/**
 * Get a permit quote from the MEE service
 * @param client - The base MEE client
 * @param params - The parameters for the quote request
 * @returns The quote payload
 * @throws If the token does not support ERC20Permit
 *
 * @example
 * ```ts
 * const quote = await getPermitQuote(meeClient, {
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
export const getPermitQuote = async (
  client: BaseMeeClient,
  params: GetPermitQuoteParams
): Promise<GetPermitQuotePayload> =>
  await getQuote(client, {
    ...params,
    permitMode: true,
    walletProvider: "BICO_V2_EOA"
  })

export default getPermitQuote
