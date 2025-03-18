import {
  GLOBAL_CONSTANTS,
  RHINESTONE_ATTESTER_ADDRESS
} from "@rhinestone/module-sdk"
import type { Hex } from "viem"
import {
  NEXUS_IMPLEMENTATION_ADDRESS,
  NEXUS_IMPLEMENTATION_ADDRESS_UNTIL_0_2
} from "../account/utils/Constants"
import type { AddressConfig } from "../account/utils/getVersion"
export * from "./abi"
export * from "./tokens"
export * from "./protocols"

export const DETERMINISTIC_DEPLOYER: Hex =
  "0x4e59b44847b379578588920ca78fbf26c0b4956c"
export const CREATE2_FACTORY_DEPLOYER_ADDRESS: Hex =
  "0x3fAB184622Dc19b6109349B94811493BF2a45362"
export const SAFE_SINGLETON_FACTORY =
  "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7"

export const ENTRY_POINT_ADDRESS: Hex =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
export const ENTRYPOINT_SIMULATIONS_ADDRESS: Hex =
  "0x74Cb5e4eE81b86e70f9045036a1C5477de69eE87"

export const NEXUS_BOOTSTRAP_ADDRESS: Hex =
  "0x879fa30248eeb693dcCE3eA94a743622170a3658"
export const BOOTSTRAP_ADDRESS_UNTIL_0_2: Hex =
  "0x000000F5b753Fdd20C5CA2D7c1210b3Ab1EA5903"

export const K1_VALIDATOR_FACTORY_ADDRESS: Hex =
  "0x2828A0E0f36d8d8BeAE95F00E2BbF235e4230fAc"
export const K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2: Hex =
  "0x00000024115AA990F0bAE0B6b0D5B8F68b684cd6"
export const K1_VALIDATOR_ADDRESS: Hex =
  "0x0000002D6DB27c52E3C11c1Cf24072004AC75cBa"

export const MEE_VALIDATOR_ADDRESS =
  "0xFbCbF8314DE6DA57ea2Bc4710115F5271041CA50"

export const BICONOMY_ATTESTER_ADDRESS: Hex =
  "0xF9ff902Cdde729b47A4cDB55EF16DF3683a04EAB"
export const BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1: Hex =
  "0xDE8FD2dBcC0CA847d11599AF5964fe2AEa153699"

export const NEXUS_ACCOUNT_FACTORY_ADDRESS =
  "0x000000c3A93d2c5E02Cb053AC675665b1c4217F9"
export const NEXUS_ACCOUNT_FACTORY_ADDRESS_UNTIL_0_2: Hex =
  "0x000000226cada0d8b36034F5D5c06855F59F6F3A"

export const LATEST_DEFAULT_ADDRESSES: AddressConfig = {
  attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
  factoryAddress: K1_VALIDATOR_FACTORY_ADDRESS,
  bootStrapAddress: NEXUS_BOOTSTRAP_ADDRESS,
  validatorAddress: K1_VALIDATOR_ADDRESS,
  accountId: "biconomy.nexus.1.0.2",
  implementationAddress: NEXUS_IMPLEMENTATION_ADDRESS
}
export const EARLIEST_DEFAULT_ADDRESSES: AddressConfig = {
  attesters: [RHINESTONE_ATTESTER_ADDRESS],
  factoryAddress: K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2,
  bootStrapAddress: NEXUS_BOOTSTRAP_ADDRESS,
  validatorAddress: K1_VALIDATOR_ADDRESS,
  accountId: "biconomy.nexus.1.0.0",
  implementationAddress: NEXUS_IMPLEMENTATION_ADDRESS_UNTIL_0_2
}

export const DEFAULT_CONFIGURATIONS_BY_VERSION: Record<string, AddressConfig> =
{
  "0.0": {
    attesters: [RHINESTONE_ATTESTER_ADDRESS],
    factoryAddress: K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2,
    bootStrapAddress: NEXUS_BOOTSTRAP_ADDRESS,
    validatorAddress: K1_VALIDATOR_ADDRESS,
    accountId: "biconomy.nexus.1.0.0",
    implementationAddress: NEXUS_IMPLEMENTATION_ADDRESS_UNTIL_0_2
  },
  "0.0.34": {
    attesters: [
      RHINESTONE_ATTESTER_ADDRESS,
      BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1
    ],
    factoryAddress: K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2,
    bootStrapAddress: NEXUS_BOOTSTRAP_ADDRESS,
    validatorAddress: K1_VALIDATOR_ADDRESS,
    accountId: "biconomy.nexus.1.0.0",
    implementationAddress: NEXUS_IMPLEMENTATION_ADDRESS_UNTIL_0_2
  },
  "0.1": {
    attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
    factoryAddress: K1_VALIDATOR_FACTORY_ADDRESS_UNTIL_0_2,
    bootStrapAddress: NEXUS_BOOTSTRAP_ADDRESS,
    validatorAddress: K1_VALIDATOR_ADDRESS,
    accountId: "biconomy.nexus.1.0.0",
    implementationAddress: NEXUS_IMPLEMENTATION_ADDRESS_UNTIL_0_2
  },
  "0.2": LATEST_DEFAULT_ADDRESSES
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
