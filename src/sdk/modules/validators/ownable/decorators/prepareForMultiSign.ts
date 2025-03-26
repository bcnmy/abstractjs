import type { Chain, Client, Hex, PublicClient, Transport } from "viem"
import { parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../../account/utils/AccountNotFound"
import type { Call } from "../../../../account/utils/Types"
import type { AnyData, ModularSmartAccount } from "../../../utils/Types"

export type PrepareForMultiSignParameters<TModularSmartAccount> = {
  /** Verification gas limit. */
  verificationGasLimit?: bigint
  /** Call gas limit. */
  callGasLimit?: bigint
  /** Pre verification gas. */
  preVerificationGas?: bigint
  /** The maximum fee per gas unit the transaction is willing to pay. */
  maxFeePerGas?: bigint
  /** The maximum priority fee per gas unit the transaction is willing to pay. */
  maxPriorityFeePerGas?: bigint
  /** The calls to be included in the user operation. */
  calls: Call[]
} & {
  account?: TModularSmartAccount
}

export type PrepareForMultiSignPayload = {
  userOpHash: Hex
  userOp: AnyData
}

export async function prepareForMultiSign<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: PrepareForMultiSignParameters<TModularSmartAccount>
): Promise<PrepareForMultiSignPayload> {
  const { account: account_ = nexusClient.account, ...rest } = parameters

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }

  const nexusAccount = parseAccount(account_) as ModularSmartAccount
  const publicClient = nexusAccount?.client as PublicClient

  if (!publicClient) {
    throw new Error("Public client not found")
  }

  // @ts-ignore
  const userOp = await nexusClient.prepareUserOperation(rest)

  // @ts-ignore
  const userOpHash = nexusAccount.getUserOpHash(userOp)

  return { userOpHash, userOp }
}
