import type { BaseMeeClient } from "../../createMeeClient"
import { type GetQuotePayload, getQuote } from "./getQuote"
import type { GetQuoteParams } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

export type GetPermitQuotePayload = { quote: GetQuotePayload } & {
  trigger: Trigger
}

export type GetPermitQuoteParams = GetQuoteParams & {
  trigger: Trigger
}

export const getPermitQuote = async (
  client: BaseMeeClient,
  parameters: GetPermitQuoteParams
): Promise<GetPermitQuotePayload> => {
  const {
    account: account_ = client.account,
    trigger,
    instructions,
    ...rest
  } = parameters

  const triggerTransfer = account_.build({
    type: "transferFrom",
    data: trigger
  })

  const quote = await getQuote(client, {
    path: "v1/quote-permit", // Use different endpoint for permit enabled tokens
    eoa: account_.signer.address,
    instructions: [triggerTransfer, ...instructions],
    ...rest
  })

  const trigger_ = {
    ...trigger,
    amount: BigInt(trigger.amount) + BigInt(quote.paymentInfo.tokenWeiAmount)
  }

  return { quote, trigger: trigger_ }
}

export default getPermitQuote
