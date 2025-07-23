import {
  GLOBAL_CONSTANTS,
  REGISTRY_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS
} from "@rhinestone/module-sdk"
import { type Hex, zeroAddress } from "viem"
import type { AddressConfig } from "../account/utils/getVersion"
export * from "./abi"
export * from "./tokens"
export * from "./protocols"

export const ENTRY_POINT_ADDRESS: Hex =
  "0x5BBA76308670E555b348204fC767Dcc62Ad1F197"
export const ENTRYPOINT_SIMULATIONS_ADDRESS: Hex =
  "0x74Cb5e4eE81b86e70f9045036a1C5477de69eE87"
export const NEXUS_BOOTSTRAP_ADDRESS: Hex =
  "0xB8aab0c542190daA7546b0ea48B7C8613c0A7454"
export const MEE_VALIDATOR_ADDRESS: Hex =
  "0x5DDC050F3129aff964307C3508c07995d9d1f4ee"
export const BICONOMY_ATTESTER_ADDRESS: Hex =
  "0xF9ff902Cdde729b47A4cDB55EF16DF3683a04EAB"
export const BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1: Hex =
  "0xDE8FD2dBcC0CA847d11599AF5964fe2AEa153699"
export const NEXUS_ACCOUNT_FACTORY_ADDRESS: Hex =
  "0xEA774bb5A2217391E0E5f9828b68C21E9176F22c"
export const COMPOSABLE_MODULE_ADDRESS: Hex =
  "0xabA841C1434eF0CdFE63f7393C0609df7294032b"
export const NEXUS_IMPLEMENTATION_ADDRESS: Hex =
  "0x7Ab43d55D4Eaee1e08aD31aE3A3BF6cFA2c3e88A"
export const FORWARDER_ADDRESS: Hex =
  "0x172C2c85cf4FAF6D44a523318326F229aFF0a91F"

export const DEFAULT_CONFIGURATIONS_BY_NEXUS_VERSION: Record<
  string,
  AddressConfig
> = {
  "1.0.2": {
    accountId: "biconomy.nexus.1.0.2",
    factoryAddress: "0xEA774bb5A2217391E0E5f9828b68C21E9176F22c",
    bootStrapAddress: "0xB8aab0c542190daA7546b0ea48B7C8613c0A7454",
    implementationAddress: "0x7Ab43d55D4Eaee1e08aD31aE3A3BF6cFA2c3e88A",
    k1ValidatorAddress: "0xe54dd54Af28D0eAEf37C6Ad413CeD4513B9C0B88", // K1 validator address
    k1FactoryAddress: "0xd5562630CBeAc845D794e684c181E39a096cFe23",
    attesters: [],
    registryAddress: zeroAddress
  }
}

// Rhinestone constants
export {
  SMART_SESSIONS_ADDRESS,
  OWNABLE_VALIDATOR_ADDRESS,
  OWNABLE_EXECUTOR_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS,
  REGISTRY_ADDRESS,
  type EnableSessionData,
  type ActionData,
  type PolicyData,
  type Session,
  SmartSessionMode,
  encodeSmartSessionSignature,
  getAddOwnableExecutorOwnerAction,
  getExecuteOnOwnedAccountAction,
  getAccount,
  getOwnableValidatorMockSignature,
  getOwnableValidatorThreshold,
  isModuleInstalled as isRhinestoneModuleInstalled,
  findTrustedAttesters,
  getTrustAttestersAction,
  getOwnableValidatorSignature,
  getAddOwnableValidatorOwnerAction,
  getOwnableValidatorOwners,
  getRemoveOwnableValidatorOwnerAction,
  getSetOwnableValidatorThresholdAction,
  decodeSmartSessionSignature,
  encodeValidationData,
  getEnableSessionDetails,
  getSmartSessionsValidator,
  getSudoPolicy,
  getSpendingLimitsPolicy,
  getUsageLimitPolicy,
  getValueLimitPolicy,
  getOwnableValidator,
  getUniversalActionPolicy
} from "@rhinestone/module-sdk"

// Rhinestone doesn't export the universal action policy address, so we need to get it from the policies
export const UNIVERSAL_ACTION_POLICY_ADDRESS: Hex =
  GLOBAL_CONSTANTS.UNIVERSAL_ACTION_POLICY_ADDRESS

export const TIME_FRAME_POLICY_ADDRESS: Hex =
  GLOBAL_CONSTANTS.TIME_FRAME_POLICY_ADDRESS

export const VALUE_LIMIT_POLICY_ADDRESS: Hex =
  GLOBAL_CONSTANTS.VALUE_LIMIT_POLICY_ADDRESS

export const USAGE_LIMIT_POLICY_ADDRESS: Hex =
  GLOBAL_CONSTANTS.USAGE_LIMIT_POLICY_ADDRESS

export const SPENDING_LIMITS_POLICY_ADDRESS: Hex =
  GLOBAL_CONSTANTS.SPENDING_LIMITS_POLICY_ADDRESS

export const SUDO_POLICY_ADDRESS: Hex = GLOBAL_CONSTANTS.SUDO_POLICY_ADDRESS

export const PERMIT_TYPEHASH =
  "0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9"
