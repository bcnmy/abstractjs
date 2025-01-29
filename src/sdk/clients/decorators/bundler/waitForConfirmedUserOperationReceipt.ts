import type { Account, Chain, Client, Transport } from "viem"
import type {
  SmartAccount,
  UserOperationReceipt
} from "viem/account-abstraction"
import { getAction, parseAccount } from "viem/utils"
import type { BicoRpcSchema } from "."
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import {
  type GetUserOperationStatusParameters,
  getUserOperationStatus
} from "./getUserOperationStatus"

export async function waitForConfirmedUserOperationReceipt<
  TAccount extends SmartAccount | undefined
>(
  client: Client<
    Transport,
    Chain | undefined,
    Account | undefined,
    BicoRpcSchema
  >,
  parameters: GetUserOperationStatusParameters & { account?: TAccount }
): Promise<UserOperationReceipt> {
  const account_ = parseAccount(
    parameters?.account ?? client.account!
  ) as SmartAccount

  if (!account_)
    throw new AccountNotFoundError({
      docsPath: "/docs/actions/wallet/waitForConfirmedUserOperationReceipt"
    })

  const userOperationStatus = await getAction(
    client,
    getUserOperationStatus,
    "getUserOperationStatus"
  )(parameters)

  // Recursively loop until the status is CONFIRMED with the pollingInterval
  if (userOperationStatus.state === "CONFIRMED") {
    userOperationStatus.userOperationReceipt.receipt
    return {
      ...userOperationStatus.userOperationReceipt,
      // Overwrite the receipt type from the confirmed status
      receipt: userOperationStatus.userOperationReceipt.receipt
    }
  }
  if (userOperationStatus.state === "REJECTED") {
    throw new Error(userOperationStatus.message)
  }

  await new Promise((resolve) =>
    setTimeout(resolve, client.pollingInterval ?? 1000)
  )
  return await getAction(
    client,
    waitForConfirmedUserOperationReceipt,
    "waitForConfirmedUserOperationReceipt"
  )(parameters)
}
