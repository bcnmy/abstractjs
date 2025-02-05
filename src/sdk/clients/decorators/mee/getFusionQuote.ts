import type { BaseMeeClient } from "../../createMeeClient"
import getOnChainQuote, { type GetOnChainQuotePayload } from "./getOnChainQuote"
import { getPaymentToken } from "./getPaymentToken"
import getPermitQuote, { type GetPermitQuotePayload } from "./getPermitQuote"
import type { GetQuoteParams } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

export type GetFusionQuotePayload =
  | GetPermitQuotePayload
  | GetOnChainQuotePayload
export type GetFusionQuoteParams = GetQuoteParams & {
  trigger: Trigger
}

export const getFusionQuote = async (
  client: BaseMeeClient,
  parameters: GetFusionQuoteParams
): Promise<GetFusionQuotePayload> => {
  const { permitEnabled } = await getPaymentToken(client, parameters.trigger)
  return permitEnabled
    ? getPermitQuote(client, parameters)
    : getOnChainQuote(client, parameters)
}

export default getFusionQuote
