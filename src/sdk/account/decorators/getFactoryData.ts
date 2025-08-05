import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeFunctionData,
  pad,
  parseAbi,
  toHex
} from "viem"
import { isVersionOlder } from ".."
import { MEEVersion } from "../../constants"
import { NexusBootstrapAbi } from "../../constants/abi/NexusBootstrapAbi"
import { NexusLegacyBootstrapAbi } from "../../constants/abi/NexusLegacyBootstrapAbi"
import type {
  GenericModuleConfig,
  PrevalidationHookModuleConfig
} from "../toNexusAccount"

// =================================================
// ============ Account Factory section ============
// =================================================

export type GetFactoryDataParams = {
  /** Account index for deterministic deployment */
  index: bigint
  initData: Hex
}

export const getFactoryData = (parameters: GetFactoryDataParams): Hex => {
  const { index, initData } = parameters

  const salt = pad(toHex(index), { size: 32 })

  return encodeFunctionData({
    abi: parseAbi([
      "function createAccount(bytes initData, bytes32 salt) external returns (address)"
    ]),
    functionName: "createAccount",
    args: [initData, salt]
  })
}

export type GetInitDataWithRegistryParams = {
  bootStrapAddress: Address
  validators: GenericModuleConfig[]
  registryAddress: Address
  attesters: Address[]
  attesterThreshold: number
  meeVersion: MEEVersion
}

// Mee 1.0.0 / Nexus 1.0.2 case: initializing it with single validator (validators[0]) and registry
export const getInitDataWithRegistry = (
  params: GetInitDataWithRegistryParams
): Hex => {
  const bootstrapData = isVersionOlder(params.meeVersion, MEEVersion.V2_0_0)
    ? encodeFunctionData({
        abi: NexusLegacyBootstrapAbi,
        functionName: "initNexusWithSingleValidator",
        args: [
          params.validators[0].module,
          params.validators[0].data,
          params.registryAddress,
          params.attesters,
          params.attesterThreshold
        ]
      })
    : encodeFunctionData({
        abi: NexusBootstrapAbi,
        functionName: "initNexusWithSingleValidator",
        args: [
          params.validators[0].module,
          params.validators[0].data,
          {
            registry: params.registryAddress,
            attesters: params.attesters,
            threshold: params.attesterThreshold
          }
        ]
      })

  return encodeAbiParameters(
    [
      { name: "bootstrap", type: "address" },
      { name: "bootstrapData", type: "bytes" }
    ],
    [params.bootStrapAddress, bootstrapData]
  )
}

export type GetInitDataNoRegistryParams = {
  defaultValidator: GenericModuleConfig
  prevalidationHooks: PrevalidationHookModuleConfig[]
  validators: GenericModuleConfig[]
  executors: GenericModuleConfig[]
  hook: GenericModuleConfig
  fallbacks: GenericModuleConfig[]
  bootStrapAddress: Address
}

// Nexus 1.2.0 case
export const getInitDataNoRegistry = (
  params: GetInitDataNoRegistryParams
): Hex => {
  return encodeAbiParameters(
    [
      { name: "bootstrap", type: "address" },
      { name: "bootstrapData", type: "bytes" }
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
}
