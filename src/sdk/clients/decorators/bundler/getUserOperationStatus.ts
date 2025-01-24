import type { Account, Chain, Client, Hex, Transport } from "viem"
import type { BicoRpcSchema } from "."
import type { AnyData } from "../../../modules/utils/Types"
import type { SmartAccount } from "viem/account-abstraction"

export type GetUserOperationStatusReturnType = AnyData

export type GetUserOperationStatusParameters = {
  userOpHash: Hex
}

export async function getUserOperationStatus<
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
  const userOperationStatus = await client.request({
    method: "biconomy_getUserOperationStatus",
    params: [parameters.userOpHash]
  })

  return userOperationStatus
}
