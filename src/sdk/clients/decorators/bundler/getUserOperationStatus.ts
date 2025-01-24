import type {
  Account,
  Chain,
  Client,
  Hex,
  TransactionReceipt,
  Transport
} from "viem"
import type { BicoRpcSchema } from "."
import type { SmartAccount } from "viem/account-abstraction"

export type GetUserOperationStatusParameters = {
  userOpHash: Hex
}

interface TransactionLog {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  transactionIndex: number
  blockHash: string
  logIndex: number
  removed: boolean
}

interface UserOperationReceipt {
  userOpHash: string
  entryPoint: string
  sender: string
  nonce: number
  success: string
  paymaster: string
  actualGasCost: number
  actualGasUsed: number
  logs: TransactionLog[]
  receipt: TransactionReceipt
}

export type GetUserOperationStatusReturnType = {
  state: "CONFIRMED" | "PENDING" | "REJECTED"
  message: string
  transactionHash: string
  userOperationReceipt: UserOperationReceipt
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
  return await client.request({
    method: "biconomy_getUserOperationStatus",
    params: [parameters.userOpHash]
  })
}
