import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload } from "./getQuote"

/**
 * Parameters for sponsoring supertransaction
 */
export type SponsorSupertransactionParams = GetQuotePayload

// interface SponsorSupertransactionResponse
//   extends Omit<GetQuotePayload, "userOps"> {
//   userOps: MeeFilledUserOpDetails & { signature?: Hex }
// }

/**
 * Response payload for sponser supertransaction
 */
export type SponsorSupertransactionPayload = {
  dummy: boolean
}

export const sponsorSupertransaction = async (
  _client: BaseMeeClient,
  _parameters: SponsorSupertransactionParams
): Promise<SponsorSupertransactionPayload> => {
  return {
    dummy: true
  }
}

export default sponsorSupertransaction
