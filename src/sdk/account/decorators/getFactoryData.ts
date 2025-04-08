import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeFunctionData,
  pad,
  parseAbi,
  toHex
} from "viem"
import { NexusBootstrapAbi } from "../../constants/abi/NexusBootstrapAbi"
import type {
  GenericModuleConfig,
  PrevalidationHookModuleConfig
} from "../toNexusAccount"

export type GetFactoryDataParams = {
  /** Hex string of the validator init data */
  initData: Hex
  /** Account index for deterministic deployment */
  index: bigint
}

export const getFactoryData = ({
  initData,
  index
}: GetFactoryDataParams): Hex => {
  const salt = pad(toHex(index), { size: 32 })

  return encodeFunctionData({
    abi: parseAbi([
      "function createAccount(bytes initData, bytes32 salt) external returns (address)"
    ]),
    functionName: "createAccount",
    args: [initData, salt]
  })
}

export type ModuleConfig = {
  module: Address
  data: Hex
}

export type GetInitDataParams = {
  defaultValidator: GenericModuleConfig
  prevalidationHooks: PrevalidationHookModuleConfig[]
  validators: GenericModuleConfig[]
  executors: GenericModuleConfig[]
  hook: GenericModuleConfig
  fallbacks: GenericModuleConfig[]
  registryAddress: Address
  bootStrapAddress: Address
}

export const getInitData = (params: GetInitDataParams): Hex =>
  encodeAbiParameters(
    [
      { name: "bootstrap", type: "address" },
      { name: "initData", type: "bytes" }
    ],
    [
      params.bootStrapAddress,
      encodeFunctionData({
        abi: NexusBootstrapAbi,
        functionName: "initNexusWithDefaultValidatorAndOtherModulesNoRegistry",
        args: [
          params.defaultValidator.data,
          params.validators,
          params.executors,
          params.hook,
          params.fallbacks,
          params.prevalidationHooks
        ]
      })
    ]
  )
