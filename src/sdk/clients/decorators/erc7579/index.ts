import type { Chain, Client, Hash, Hex, Transport } from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import type { Call } from "../../../account"
import type { AnyData, ModuleType } from "../../../modules/utils/Types.js"
import { accountId } from "./accountId.js"
import {
  type GetActiveHookParameters,
  getActiveHook,
  toGetActiveHookReads
} from "./getActiveHook.js"
import {
  type GetFallbackBySelectorParameters,
  getFallbackBySelector,
  toGetFallbackBySelectorReads
} from "./getFallbackBySelector.js"
import {
  type GetInstalledExecutorsParameters,
  getInstalledExecutors,
  toGetInstalledExecutorsReads
} from "./getInstalledExecutors.js"
import {
  type GetInstalledValidatorsParameters,
  getInstalledValidators,
  toGetInstalledValidatorsReads
} from "./getInstalledValidators.js"
import {
  type GetPreviousModuleParameters,
  getPreviousModule
} from "./getPreviousModule.js"
import {
  type InstallModuleParameters,
  installModule,
  toInstallModuleCalls,
  toInstallWithSafeSenderCalls,
  toSafeSenderCalls
} from "./installModule.js"
import {
  type InstallModulesParameters,
  installModules
} from "./installModules.js"
import {
  type IsModuleInstalledParameters,
  isModuleInstalled,
  toIsModuleInstalledReads
} from "./isModuleInstalled.js"
import {
  type SupportsExecutionModeParameters,
  supportsExecutionMode,
  toSupportsExecutionModeReads
} from "./supportsExecutionMode.js"
import type { CallType, ExecutionMode } from "./supportsExecutionMode.js"
import {
  type SupportsModuleParameters,
  supportsModule,
  toSupportsModuleReads
} from "./supportsModule.js"
import { toUninstallFallbackCalls } from "./uninstallFallback.js"
import {
  type UninstallModuleParameters,
  toUninstallModuleCalls,
  uninstallModule
} from "./uninstallModule.js"
import {
  type UninstallModulesParameters,
  uninstallModules
} from "./uninstallModules.js"

export type Erc7579Actions<TSmartAccount extends SmartAccount | undefined> = {
  accountId: (args?: { account?: TSmartAccount }) => Promise<string>
  installModule: (args: InstallModuleParameters<TSmartAccount>) => Promise<Hash>
  installModules: (
    args: InstallModulesParameters<TSmartAccount>
  ) => Promise<Hash>
  isModuleInstalled: (
    args: IsModuleInstalledParameters<TSmartAccount>
  ) => Promise<boolean>
  supportsExecutionMode: (
    args: SupportsExecutionModeParameters<TSmartAccount>
  ) => Promise<boolean>
  supportsModule: (
    args: SupportsModuleParameters<TSmartAccount>
  ) => Promise<boolean>
  uninstallModule: (
    args: UninstallModuleParameters<TSmartAccount>
  ) => Promise<Hash>
  uninstallModules: (
    args: UninstallModulesParameters<TSmartAccount>
  ) => Promise<Hash>
  getInstalledValidators: (
    args?: GetInstalledValidatorsParameters<TSmartAccount>
  ) => Promise<readonly [readonly Hex[], Hex]>
  getInstalledExecutors: (
    args?: GetInstalledExecutorsParameters<TSmartAccount>
  ) => Promise<readonly [readonly Hex[], Hex]>
  getActiveHook: (args?: GetActiveHookParameters<TSmartAccount>) => Promise<Hex>
  getFallbackBySelector: (
    args: GetFallbackBySelectorParameters<TSmartAccount>
  ) => Promise<[Hex, Hex]>
  getPreviousModule: (
    args: GetPreviousModuleParameters<TSmartAccount>
  ) => Promise<Hex>
}

export type {
  InstallModuleParameters,
  IsModuleInstalledParameters,
  CallType,
  ExecutionMode,
  SupportsExecutionModeParameters,
  ModuleType,
  SupportsModuleParameters,
  UninstallModuleParameters,
  GetInstalledValidatorsParameters,
  GetInstalledExecutorsParameters,
  GetActiveHookParameters,
  GetPreviousModuleParameters
}

export {
  accountId,
  installModule,
  installModules,
  isModuleInstalled,
  supportsExecutionMode,
  supportsModule,
  uninstallModule,
  uninstallModules,
  getInstalledValidators,
  getInstalledExecutors,
  getActiveHook,
  getFallbackBySelector,
  getPreviousModule
}

export function erc7579Actions() {
  return <TSmartAccount extends SmartAccount | undefined>(
    client: Client<Transport, Chain | undefined, TSmartAccount>
  ): Erc7579Actions<TSmartAccount> => ({
    accountId: (args) => accountId(client, args),
    installModule: (args) => installModule(client, args),
    installModules: (args) => installModules(client, args),
    isModuleInstalled: (args) => isModuleInstalled(client, args),
    supportsExecutionMode: (args) => supportsExecutionMode(client, args),
    supportsModule: (args) => supportsModule(client, args),
    uninstallModule: (args) => uninstallModule(client, args),
    uninstallModules: (args) => uninstallModules(client, args),
    getInstalledValidators: (args) => getInstalledValidators(client, args),
    getInstalledExecutors: (args) => getInstalledExecutors(client, args),
    getActiveHook: (args) => getActiveHook(client, args),
    getFallbackBySelector: (args) => getFallbackBySelector(client, args),
    getPreviousModule: (args) => getPreviousModule(client, args)
  })
}

export type CallFn = (...args: AnyData[]) => Promise<Call[]>
export type ReadFn = (...args: AnyData[]) => Promise<any>
export type CallDictionary = Record<string, CallFn>
export type ReadDictionary = Record<string, ReadFn>

export const erc7579Calls = {
  toInstallModuleCalls,
  toUninstallModuleCalls,
  toInstallWithSafeSenderCalls,
  toSafeSenderCalls,
  toUninstallFallbackCalls
} as const

export const erc7579Reads = {
  toIsModuleInstalledReads,
  toGetActiveHookReads,
  toGetFallbackBySelectorReads,
  toGetInstalledExecutorsReads,
  toGetInstalledValidatorsReads,
  toSupportsExecutionModeReads,
  toSupportsModuleReads
} as const
