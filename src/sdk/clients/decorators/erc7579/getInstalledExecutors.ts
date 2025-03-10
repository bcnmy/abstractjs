import type { Chain, Client, Hex, Transport } from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import { readContract } from "viem/actions"
import { getAction, parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import { SENTINEL_ADDRESS } from "../../../account/utils/Constants"

export type GetInstalledExecutorsParameters<
  TSmartAccount extends SmartAccount | undefined
> = { account?: TSmartAccount } & {
  pageSize?: bigint
  cursor?: Hex
}

/**
 * Retrieves the installed executors for a given smart account.
 *
 * @param client - The client instance.
 * @param parameters - Parameters including the smart account, page size, and cursor.
 * @returns A tuple containing an array of executor addresses and the next cursor.
 * @throws {AccountNotFoundError} If the account is not found.
 *
 * @example
 * import { getInstalledExecutors } from '@biconomy/abstractjs'
 *
 * const [executors, nextCursor] = await getInstalledExecutors(nexusClient, {
 *   pageSize: 10n
 * })
 * console.log(executors, nextCursor) // ['0x...', '0x...'], '0x...'
 */
export async function getInstalledExecutors<
  TSmartAccount extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TSmartAccount>,
  parameters?: GetInstalledExecutorsParameters<TSmartAccount>
): Promise<readonly [readonly Hex[], Hex]> {
  const account_ = parameters?.account ?? client.account
  const pageSize = parameters?.pageSize ?? 100n
  const cursor = parameters?.cursor ?? SENTINEL_ADDRESS

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }

  const account = parseAccount(account_) as SmartAccount

  const publicClient = account.client

  return getAction(
    publicClient,
    readContract,
    "readContract"
  )({
    address: account.address,
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "cursor",
            type: "address"
          },
          {
            internalType: "uint256",
            name: "size",
            type: "uint256"
          }
        ],
        name: "getExecutorsPaginated",
        outputs: [
          {
            internalType: "address[]",
            name: "array",
            type: "address[]"
          },
          {
            internalType: "address",
            name: "next",
            type: "address"
          }
        ],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "getExecutorsPaginated",
    args: [cursor, pageSize]
  }) as Promise<readonly [readonly Hex[], Hex]>
}
