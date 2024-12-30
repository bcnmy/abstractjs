import { Signer } from "@biconomy/sdk";
import { Hex } from "viem";
import { ExecutionMode, formatMeeSignature, FormattedMeeSignature, MeeCommitedSupertransactionQuote, MeeExecuteParams } from "../mee.service";

export async function signMeeQuote(params: {
  signer: Signer,
  quote: MeeCommitedSupertransactionQuote,
  executionMode: ExecutionMode
}): Promise<MeeExecuteParams> {

  const { executionMode,quote,signer } = params
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