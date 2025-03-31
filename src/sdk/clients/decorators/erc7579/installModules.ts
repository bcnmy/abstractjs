import type { Address, Chain, Client, Hex, Transport } from "viem"
import { type SmartAccount, sendUserOperation } from "viem/account-abstraction"
import { getAction, parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import type {
  ModularSmartAccount,
  ModuleType
} from "../../../modules/utils/Types"
import { toInstallWithSafeSenderCalls } from "./installModule"

export type InstallModulesParameters<
  TSmartAccount extends SmartAccount | undefined
> = { account?: TSmartAccount } & {
  modules: {
    type: ModuleType
    address: Address
    data: Hex
  }[]
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: bigint
}

/**
 * Installs multiple modules on a given smart account.
 *
 * @param client - The client instance.
 * @param parameters - Parameters including the smart account, modules to install, and optional gas settings.
 * @returns The hash of the user operation as a hexadecimal string.
 * @throws {AccountNotFoundError} If the account is not found.
 *
 * @example
 * import { installModules } from '@biconomy/abstractjs'
 *
 * const userOpHash = await installModules(nexusClient, {
 *   modules: [
 *     { type: 'executor', address: '0x...', context: '0x' },
 *     { type: 'validator', address: '0x...', context: '0x' }
 *   ]
 * })
 * console.log(userOpHash) // '0x...'
 */
export async function installModules<
  TSmartAccount extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TSmartAccount>,
  parameters: InstallModulesParameters<TSmartAccount>
): Promise<Hex> {
  const {
    account: account_ = client.account,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    modules
  } = parameters

  if (!account_) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }

  const account = parseAccount(account_) as unknown as ModularSmartAccount
  const calls = (
    await Promise.all(
      modules.flatMap((module) => toInstallWithSafeSenderCalls(account, module))
    )
  ).flat()

  return getAction(
    client,
    sendUserOperation,
    "sendUserOperation"
  )({
    calls,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce,
    account
  })
}
