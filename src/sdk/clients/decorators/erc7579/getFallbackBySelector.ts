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
import { GENERIC_FALLBACK_SELECTOR } from "../../../account/utils/Constants"
import type { ModularSmartAccount } from "../../../modules/utils/Types"

export type GetFallbackBySelectorParameters<
  TSmartAccount extends SmartAccount | undefined
> = { account?: TSmartAccount } & Partial<{
  selector?: Hex
}>

const abi = [
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4"
      }
    ],
    name: "getFallbackHandlerBySelector",
    outputs: [
      {
        internalType: "CallType",
        name: "",
        type: "bytes1"
      },
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
]

/**
 * Retrieves the fallback handler for a given selector in a smart account.
 *
 * @param client - The client instance.
 * @param parameters - Parameters including the smart account and optional selector.
 * @returns A tuple containing the call type and address of the fallback handler.
 * @throws {AccountNotFoundError} If the account is not found.
 *
 * @example
 * import { getFallbackBySelector } from '@biconomy/abstractjs'
 *
 * const [callType, handlerAddress] = await getFallbackBySelector(nexusClient, {
 *   selector: '0x12345678'
 * })
 * console.log(callType, handlerAddress) // '0x1' '0x...'
 */
export async function getFallbackBySelector<
  TSmartAccount extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TSmartAccount>,
  parameters: GetFallbackBySelectorParameters<TSmartAccount>
): Promise<[Hex, Hex]> {
  const {
    account: account_ = client.account,
    selector = GENERIC_FALLBACK_SELECTOR
  } = parameters

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }

  const account = parseAccount(account_) as unknown as ModularSmartAccount
  const publicClient = account.client

  const [getFallbackBySelectorRead] = await toGetFallbackBySelectorReads(
    account,
    selector
  )

  return getAction(
    publicClient,
    readContract,
    "readContract"
  )(getFallbackBySelectorRead) as Promise<[Hex, Hex]>
}

export const toGetFallbackBySelectorReads = async (
  account: ModularSmartAccount,
  selector: Hex
): Promise<
  ReadContractParameters<typeof abi, "getFallbackHandlerBySelector", [Hex]>[]
> => [
  {
    address: account.address,
    abi,
    functionName: "getFallbackHandlerBySelector",
    args: [selector]
  }
]
