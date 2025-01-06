import type { Signer } from "@biconomy/sdk"
import { Hex } from "viem"
import {
  type ExecutionMode,
  FormattedMeeSignature,
  type MeeCommitedSupertransactionQuote,
  type MeeExecuteParams,
  formatMeeSignature
} from "../mee.service"

export async function signMeeQuote(params: {
  signer: Signer
  quote: MeeCommitedSupertransactionQuote
  executionMode: ExecutionMode
}): Promise<MeeExecuteParams> {
  const { executionMode, quote, signer } = params
  const signedMessage = await signer.signMessage({
    message: {
      raw: quote.hash
    }
  })
  return {
    quote: quote,
    signature: await formatMeeSignature({
      executionMode: executionMode,
      signedHash: signedMessage
    })
  }
}
