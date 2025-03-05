import {
  type Chain,
  type Client,
  type Hash,
  type Hex,
  type Transport,
  encodeFunctionData,
  getAddress
} from "viem"
import {
  type SmartAccount,
  type UserOperation,
  sendUserOperation
} from "viem/account-abstraction"
import { getAction, parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import { LATEST_DEFAULT_ADDRESSES } from "../../../constants"

export type UpgradeSmartAccountParameters<
  TSmartAccount extends SmartAccount | undefined
> = { account?: TSmartAccount } & {
  /** Optional custom implementation address. If not provided, the latest default implementation will be used */
  implementationAddress?: Hex
  /** Optional initialization data to pass to the new implementation */
  initData?: Hex
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: bigint
} & Partial<Omit<UserOperation<"0.7", bigint>, "callData">>

/**
 * Upgrades a smart account to a new implementation.
 *
 * @param client - The client instance.
 * @param parameters - Parameters including the smart account, optional custom implementation address, and gas settings.
 * @returns The hash of the user operation as a hexadecimal string.
 * @throws {AccountNotFoundError} If the account is not found.
 *
 * @example
 * import { upgradeSmartAccount } from '@biconomy/abstractjs'
 *
 * const userOpHash = await upgradeSmartAccount(nexusClient, {
 *   // Optional custom implementation address
 *   implementationAddress: '0x...',
 *   // Optional initialization data
 *   initData: '0x'
 * })
 * console.log(userOpHash) // '0x...'
 */
export async function upgradeSmartAccount<
  TSmartAccount extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TSmartAccount>,
  parameters?: UpgradeSmartAccountParameters<TSmartAccount>
): Promise<Hash> {
  const {
    account: account_ = client.account,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    implementationAddress = LATEST_DEFAULT_ADDRESSES.implementationAddress,
    initData = "0x",
    ...rest
  } = parameters ?? {}

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#upgradeSmartAccount"
    })
  }

  const account = parseAccount(account_) as SmartAccount

  const calls = [
    {
      to: account.address,
      value: BigInt(0),
      data: encodeFunctionData({
        abi: [
          {
            name: "upgradeToAndCall",
            type: "function",
            stateMutability: "payable",
            inputs: [
              {
                type: "address",
                name: "newImplementation"
              },
              {
                type: "bytes",
                name: "data"
              }
            ],
            outputs: []
          }
        ],
        functionName: "upgradeToAndCall",
        args: [getAddress(implementationAddress), initData]
      })
    }
  ]

  const sendUserOperationParams = {
    calls,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    account,
    ...rest
  }

  return getAction(
    client,
    sendUserOperation,
    "sendUserOperation"
  )(sendUserOperationParams)
}
