import type { Chain, Client, Hex, Transport } from "viem"
import { type SmartAccount, sendUserOperation } from "viem/account-abstraction"
import { getAction } from "viem/utils"
import { parseAccount } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import type {
  ModularSmartAccount,
  ModuleMeta
} from "../../../modules/utils/Types"
import { toUninstallModuleCalls } from "./uninstallModule"

export type UninstallModulesParameters<
  TSmartAccount extends SmartAccount | undefined
> = { account?: TSmartAccount } & {
  modules: ModuleMeta[]
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: bigint
}

/**
 * Uninstalls multiple modules from a smart account.
 *
 * @param client - The client instance.
 * @param parameters - Parameters including the smart account, modules to uninstall, and optional gas settings.
 * @returns The hash of the user operation as a hexadecimal string.
 * @throws {AccountNotFoundError} If the account is not found.
 *
 * @example
 * import { uninstallModules } from '@biconomy/abstractjs'
 *
 * const userOpHash = await uninstallModules(nexusClient, {
 *   modules: [
 *     { type: 'executor', address: '0x...', context: '0x' },
 *     { type: 'validator', address: '0x...', context: '0x' }
 *   ]
 * })
 * console.log(userOpHash) // '0x...'
 */
export async function uninstallModules<
  TSmartAccount extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, TSmartAccount>,
  parameters: UninstallModulesParameters<TSmartAccount>
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
      modules.flatMap((module) => toUninstallModuleCalls(account, module))
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
