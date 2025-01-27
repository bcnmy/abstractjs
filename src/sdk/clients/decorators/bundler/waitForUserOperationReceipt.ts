import type { Account, Chain, Client, Transport } from "viem"
import {
  waitForUserOperationReceipt as waitForUserOperationReceipt_,
  type WaitForUserOperationReceiptReturnType,
  type WaitForUserOperationReceiptParameters
} from "viem/account-abstraction"
import { getAction } from "viem/utils"
import type { BicoRpcSchema } from "."
import { waitForConfirmedUserOperationReceipt } from "./waitForConfirmedUserOperationReceipt"

export async function waitForUserOperationReceipt(
  client: Client<
    Transport,
    Chain | undefined,
    Account | undefined,
    BicoRpcSchema
  >,
  parameters: WaitForUserOperationReceiptParameters
): Promise<WaitForUserOperationReceiptReturnType> {
  return await Promise.any([
    getAction(
      client,
      waitForUserOperationReceipt_,
      "waitForUserOperationReceipt"
    )(parameters),
    getAction(
      client,
      waitForConfirmedUserOperationReceipt,
      "waitForConfirmedUserOperationReceipt"
    )(parameters)
  ])
}
