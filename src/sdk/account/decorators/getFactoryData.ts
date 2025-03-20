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
import type { GenericModuleConfig } from "../toNexusAccount"

export type GetUniversalFactoryDataParams = {
  /** Hex string of the validator init data */
  initData: Hex
  /** Account index for deterministic deployment */
  index: bigint
}

export const getUniversalFactoryData = ({
  initData,
  index
}: GetUniversalFactoryDataParams): Hex => {
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
  validators: GenericModuleConfig[]
  executors: GenericModuleConfig[]
  hook: GenericModuleConfig
  fallbacks: GenericModuleConfig[]
  registryAddress: Address
  attesters: Address[]
  attesterThreshold: number
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
        functionName: "initNexus",
        args: [
          params.validators,
          params.executors,
          params.hook,
          params.fallbacks,
          params.registryAddress,
          params.attesters,
          params.attesterThreshold
        ]
      })
    ]
  )
