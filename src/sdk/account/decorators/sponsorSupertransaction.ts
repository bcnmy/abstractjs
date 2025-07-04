import { concatHex, encodeAbiParameters, type Hex } from "viem"
import type { MultichainSmartAccount } from ".."
import type { GetQuotePayload } from "../../clients/decorators/mee/getQuote"
import { createMerkleTree } from "../../modules"
import { DEFAULT_PREFIX } from "../../clients/decorators/mee"

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

  const leafHashes = quote.userOps.map((userOp) => {
    return userOp.shortEncoding ? userOp.userOpHash : userOp.meeUserOpHash
  })

  const merkleTree = createMerkleTree(leafHashes)

  if (merkleTree.root !== quote.hash) {
    throw new Error(
      "Invalid merkle tree rebuilt from the quote. Cant approve sponsorship."
    )
  }

  const rawSignature = await signer.signMessage({
    message: {
      raw: quote.hash
    }
  })

  const proof = merkleTree.getProof(0) as Hex[]

  const sponsorshipSignedQuote = quote

  sponsorshipSignedQuote.userOps[0].userOp.signature = concatHex([
    DEFAULT_PREFIX,
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint48" },
        { type: "uint48" },
        { type: "bytes32[]" },
        { type: "bytes" }
      ],
      [
        sponsorshipSignedQuote.hash,
        Number(sponsorshipSignedQuote.userOps[0].lowerBoundTimestamp),
        Number(sponsorshipSignedQuote.userOps[0].upperBoundTimestamp),
        proof,
        rawSignature
      ]
    )
  ])

  return sponsorshipSignedQuote
}

export default sponsorSupertransaction
