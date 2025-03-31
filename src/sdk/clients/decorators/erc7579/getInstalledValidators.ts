import type {
  Chain,
  Client,
  Hex,
  ReadContractParameters,
  Transport
} from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import { readContract } from "viem/actions"
import { getAction, parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import { SENTINEL_ADDRESS } from "../../../account/utils/Constants"
import type { ModularSmartAccount } from "../../../modules/utils/Types"

export type GetInstalledValidatorsParameters<
  TSmartAccount extends SmartAccount | undefined
> = { account?: TSmartAccount } & {
  pageSize?: bigint
  cursor?: Hex
}

const abi = [
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
    name: "getValidatorsPaginated",
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
] as const

/**
 * Retrieves the installed validators for a given smart account.
 *
 * @param client - The client instance.
 * @param parameters - Parameters including the smart account, page size, and cursor.
 * @returns A tuple containing an array of validator addresses and the next cursor.
 * @throws {AccountNotFoundError} If the account is not found.
 *
 * @example
 * import { getInstalledValidators } from '@biconomy/abstractjs'
 *
 * const [validators, nextCursor] = await getInstalledValidators(nexusClient, {
 *   pageSize: 10n
 * })
 * console.log(validators, nextCursor) // ['0x...', '0x...'], '0x...'
 */
export async function getInstalledValidators<
  TSmartAccount extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TSmartAccount>,
  parameters?: GetInstalledValidatorsParameters<TSmartAccount>
): Promise<readonly [readonly Hex[], Hex]> {
  const {
    account: account_ = client.account,
    pageSize = 100n,
    cursor = SENTINEL_ADDRESS
  } = parameters ?? {}

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }

  const account = parseAccount(account_) as unknown as ModularSmartAccount
  const publicClient = account.client

  const [getInstalledValidatorsRead] = await toGetInstalledValidatorsReads(
    account,
    { pageSize, cursor }
  )

  return getAction(
    publicClient,
    readContract,
    "readContract"
  )(getInstalledValidatorsRead) as Promise<readonly [readonly Hex[], Hex]>
}

export const toGetInstalledValidatorsReads = async (
  account: ModularSmartAccount,
  {
    pageSize = 100n,
    cursor = SENTINEL_ADDRESS
  }: GetInstalledValidatorsParameters<ModularSmartAccount>
): Promise<
  ReadContractParameters<typeof abi, "getValidatorsPaginated", [Hex, bigint]>[]
> => [
  {
    address: account.address,
    abi,
    functionName: "getValidatorsPaginated",
    args: [cursor, pageSize]
  }
]
