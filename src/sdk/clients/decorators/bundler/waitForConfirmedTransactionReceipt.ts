import type { Account, Chain, Client, PublicClient, Transport } from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import { getAction, parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import {
  getUserOperationStatus,
  type GetUserOperationStatusParameters,
  type GetUserOperationStatusReturnType
} from "./getUserOperationStatus"
import type { BicoRpcSchema } from "."

export async function waitForConfirmedTransactionReceipt<
  TAccount extends SmartAccount | undefined
>(
  client: Client<
    Transport,
    Chain | undefined,
    Account | undefined,
    BicoRpcSchema
  >,
  parameters: GetUserOperationStatusParameters & { account?: TAccount }
): Promise<GetUserOperationStatusReturnType> {
  const account_ = parseAccount(
    parameters?.account ?? client.account!
  ) as SmartAccount

  if (!account_)
    throw new AccountNotFoundError({
      docsPath: "/docs/actions/wallet/waitForConfirmedTransactionReceipt"
    })

  const userOperationStatus = await getAction(
    client,
    getUserOperationStatus,
    "getUserOperationStatus"
  )(parameters)

  // Recursively loop until the status is CONFIRMED with the pollingInterval
  if (userOperationStatus.status === "CONFIRMED") return userOperationStatus

  await new Promise((resolve) =>
    setTimeout(resolve, client.pollingInterval ?? 1000)
  )
  return await getAction(
    client,
    waitForConfirmedTransactionReceipt,
    "waitForConfirmedTransactionReceipt"
  )(parameters)
}
