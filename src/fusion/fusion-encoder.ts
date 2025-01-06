import type { Call } from "@biconomy/sdk"
import {
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
  concatHex,
  encodeAbiParameters
} from "viem"
import type {
  MeeCommitedSupertransactionQuote,
  MeeService
} from "../mee.service"

export type FusionTransactionParameters = {
  companionSupertransaction: MeeCommitedSupertransactionQuote
  client: WalletClient<Transport, Chain, Account> &
    Pick<PublicClient, "waitForTransactionReceipt">
  eoaTriggerTransaction: Call
  meeService: MeeService
}

export const FUSION_EXEC_PREFIX = "0x01"
export const FUSION_NATIVE_TRANSFER_PREFIX = "0x150b7a02"
export async function executeFusionSupertransaction(
  params: FusionTransactionParameters
) {
  const {
    client,
    companionSupertransaction: supertransactionQuote,
    eoaTriggerTransaction: triggerTransaction,
    meeService
  } = params

  // If the data field is empty, a prefix must be added in order for the
  // chain not to reject the transaction. This is done in cases when the
  // user is using the transfer of native gas to the SCA as the trigger
  // transaction
  const data = triggerTransaction.data ?? FUSION_NATIVE_TRANSFER_PREFIX

  const fusionCall = {
    ...triggerTransaction,
    data: concatHex([data, FUSION_EXEC_PREFIX, supertransactionQuote.hash])
  }
  const txHash = await client.sendTransaction({
    ...fusionCall
  })
  const reciept = await client.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1
  })
  const meeResult = await meeService.execute({
    quote: supertransactionQuote,
    signature: concatHex([
      FUSION_EXEC_PREFIX,
      encodeAbiParameters(
        [{ type: "bytes32" }, { type: "uint256" }],
        [txHash, BigInt(client.chain.id)]
      )
    ])
  })
  return {
    onchainReciept: reciept,
    supertransactionHash: meeResult.hash
  }
}
