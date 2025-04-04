import { GLOBAL_CONSTANTS } from "@rhinestone/module-sdk"
import type { Hex } from "viem"
export * from "./abi"
export * from "./tokens"
export * from "./protocols"

export const ENTRY_POINT_ADDRESS: Hex =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
export const ENTRYPOINT_SIMULATIONS_ADDRESS: Hex =
  "0x74Cb5e4eE81b86e70f9045036a1C5477de69eE87"
export const NEXUS_BOOTSTRAP_ADDRESS: Hex =
  "0x00000000D3254452a909E4eeD47455Af7E27C289"
export const MEE_VALIDATOR_ADDRESS: Hex =
  "0x00000000d12897DDAdC2044614A9677B191A2d95"
export const BICONOMY_ATTESTER_ADDRESS: Hex =
  "0xF9ff902Cdde729b47A4cDB55EF16DF3683a04EAB"
export const BICONOMY_ATTESTER_ADDRESS_UNTIL_0_1: Hex =
  "0xDE8FD2dBcC0CA847d11599AF5964fe2AEa153699"
export const NEXUS_ACCOUNT_FACTORY_ADDRESS: Hex =
  "0x000000001D1D5004a02bAfAb9de2D6CE5b7B13de"
export const COMPOSABLE_MODULE_ADDRESS: Hex =
  "0x00000004430bB055dB66eBef6Fe5Ee1DA9668B10"
export const NEXUS_IMPLEMENTATION_ADDRESS: Hex =
  "0x000000004F43C49e93C970E84001853a70923B03"

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
