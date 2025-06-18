import type { MultichainSmartAccount } from ".."
import type { GetQuotePayload } from "../../clients/decorators/mee/getQuote"

/**
 * Parameters for signing quote for sponsorship
 */
export type SponsorSupertransactionParams = {
  chainId: number
  quote: GetQuotePayload
}

export const sponsorSupertransaction = async (
  mcNexus: MultichainSmartAccount,
  params: SponsorSupertransactionParams
): Promise<GetQuotePayload> => {
  const { chainId, quote } = params
  const { signer } = mcNexus.deploymentOn(chainId, true)

  const sponsorshipSignedQuote = quote

  sponsorshipSignedQuote.userOps[0].userOp.signature = await signer.signMessage(
    {
      message: {
        raw: sponsorshipSignedQuote.userOps[0].userOpHash
      }
    }
  )

  return sponsorshipSignedQuote
}

export default sponsorSupertransaction
