import type { Address, Chain, Hex } from "viem"
import type { SmartAccount } from "viem/account-abstraction"
import type { NexusSmartAccountImplementation } from "../../account/toNexusAccount"
import type { Validator } from "../validators/toValidator"

export type SignerData = {
  /** This is not the public as provided by viem, key but address for the given pvKey */
  pbKey: Hex
  /** Private key */
  pvKey: Hex
}

export type ChainInfo = number | Chain

export type CreateSessionDataResponse = {
  data: string
  sessionIDInfo: Array<string>
}

export type Execution = {
  target: Address
  value: bigint
  callData: Hex
}

export enum SafeHookType {
  GLOBAL = 0,
  SIG = 1
}

export type ModuleType = "validator" | "executor" | "fallback" | "hook"

type ModuleTypeIds = {
  [index in ModuleType]: 1 | 2 | 3 | 4
}

export const moduleTypeIds: ModuleTypeIds = {
  validator: 1,
  executor: 2,
  fallback: 3,
  hook: 4
}
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export type AnyData = any

export type Modularity = {
  getModule: () => Validator
  setModule: (module: Validator) => void
}
export type ModularSmartAccount =
  SmartAccount<NexusSmartAccountImplementation> & Modularity

export type ModuleMeta = {
  address: Hex
  type: ModuleType
  initData?: Hex
  deInitData?: Hex
}
