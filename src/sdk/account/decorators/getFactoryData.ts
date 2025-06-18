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
import { NexusBootstrapAbi } from "../../constants/abi/NexusBootstrapAbi"
import { NexusLegacyBootstrapAbi } from "../../constants/abi/NexusLegacyBootstrapAbi"
import type {
  GenericModuleConfig,
  PrevalidationHookModuleConfig
} from "../toNexusAccount"
import type { NexusVersion } from "../utils/getVersion"

// ============ K1 Factory section ============

/**
 * Parameters for generating K1 factory initialization data
 * @property signerAddress - {@link Address} The address of the EOA signer
 * @property index - Account index as BigInt for deterministic deployment
 * @property attesters - Array of {@link Address} attester addresses for account verification
 * @property attesterThreshold - Minimum number of attesters required for validation
 */
export type GetK1FactoryDataParams = {
  signerAddress: Address
  index: bigint
  attesters: Address[]
  attesterThreshold: number
}

/**
 * Generates encoded factory data for K1 account creation
 *
 * @param params - {@link GetK1FactoryDataParams} Parameters for K1 account creation
 * @param params.signerAddress - The address of the EOA signer
 * @param params.index - Account index for deterministic deployment
 * @param params.attesters - Array of attester addresses
 * @param params.attesterThreshold - Minimum number of attesters required
 *
 * @returns Promise resolving to {@link Hex} encoded function data for account creation
 *
 * @example
 * const factoryData = await getK1FactoryData({
 *   signerAddress: "0x123...",
 *   index: BigInt(0),
 *   attesters: ["0xabc...", "0xdef..."],
 *   attesterThreshold: 2
 * });
 */
export const getK1FactoryData = ({
  signerAddress,
  index,
  attesters,
  attesterThreshold
}: GetK1FactoryDataParams): Hex =>
  encodeFunctionData({
    abi: parseAbi([
      "function createAccount(address eoaOwner, uint256 index, address[] attesters, uint8 threshold) external returns (address)"
    ]),
    functionName: "createAccount",
    args: [signerAddress, index, attesters, attesterThreshold]
  })

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

export type GetInitDataParams = {
  defaultValidator: GenericModuleConfig
  prevalidationHooks: PrevalidationHookModuleConfig[]
  validators: GenericModuleConfig[]
  executors: GenericModuleConfig[]
  hook: GenericModuleConfig
  fallbacks: GenericModuleConfig[]
  bootStrapAddress: Address
  registryAddress?: Address
  attesters?: Address[]
  attesterThreshold?: number
  nexusVersion?: NexusVersion
}

export const getInitData = (parameters: GetInitDataParams): Hex => {
  const {
    registryAddress,
    attesters,
    attesterThreshold,
    defaultValidator,
    prevalidationHooks,
    validators,
    executors,
    hook,
    fallbacks,
    bootStrapAddress,
    nexusVersion = "1.2.0"
  } = parameters

  return registryAddress && attesters && attesterThreshold
    ? getInitDataWithRegistry({
        bootStrapAddress,
        validators,
        registryAddress,
        attesters,
        attesterThreshold,
        nexusVersion
      })
    : getInitDataNoRegistry({
        defaultValidator,
        prevalidationHooks,
        validators,
        executors,
        hook,
        fallbacks,
        bootStrapAddress
      })
}

export type GetInitDataWithRegistryParams = {
  bootStrapAddress: Address
  validators: GenericModuleConfig[]
  registryAddress: Address
  attesters: Address[]
  attesterThreshold: number
  nexusVersion: NexusVersion
}

// Nexus 1.0.2 case: initializing it with single validator (validators[0]) and registry
export const getInitDataWithRegistry = (
  params: GetInitDataWithRegistryParams
): Hex => {
  const bootstrapData = isVersionOlder(params.nexusVersion, "1.2.0")
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
