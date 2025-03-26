import type { Chain, Client, Hex, PublicClient, Transport } from "viem"
import { type UserOperation, sendUserOperation } from "viem/account-abstraction"
import { parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../../account/utils/AccountNotFound"
import { getOwnableValidatorSignature } from "../../../../constants"
import type { AnyData, ModularSmartAccount } from "../../../utils/Types"

export type MultiSignParameters<TModularSmartAccount> = {
  signatures: Hex[]
  userOp: UserOperation<"0.7", bigint>
} & {
  account?: TModularSmartAccount
}

export async function multiSign<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: MultiSignParameters<TModularSmartAccount>
): Promise<Hex> {
  const { account: account_ = client.account, signatures, ...rest } = parameters

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }

  const account = parseAccount(account_) as ModularSmartAccount
  const publicClient = account?.client as PublicClient

  if (!publicClient) {
    throw new Error("Public client not found")
  }

  return sendUserOperation(client, {
    ...rest,
    signature: getOwnableValidatorSignature({ signatures })
  } as AnyData)
}
