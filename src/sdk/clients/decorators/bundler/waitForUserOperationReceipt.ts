import type { Account, Chain, Client, Transport } from "viem"
import {
  type WaitForUserOperationReceiptParameters,
  type WaitForUserOperationReceiptReturnType,
  waitForUserOperationReceipt as waitForUserOperationReceipt_
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
