import { GLOBAL_CONSTANTS } from "@rhinestone/module-sdk"
import { type Address, type Hex, zeroAddress } from "viem"
import type { MEEVersionConfig } from "../account/utils/getVersion"
export * from "./abi"
export * from "./tokens"
export * from "./protocols"

/**
 * Supported MEE versions with descriptions.
 */
export enum MEEVersion {
  /** New K1 Mee module introduced that allows ERC-7702-delegated EOAs owning Nexus accounts */
  V2_1_0 = "2.1.0",

  /** Major release, featuring Nexus 1.2.0 with ERC-7702 support and native composability.
   * MEE K1 Validator is pre-installed as a default validator module.
   */
  V2_0_0 = "2.0.0",

  /** Nexus v1.0.2 release with New Account Factory and MEE K1 Validator v1.0.3
   * This is compiled for chains which only has evm Paris (No PUSH0, no MCOPY, no TSTORE)
   */
  V1_1_0 = "1.1.0",

  /** First release for the MEE contracts suite, based on Nexus 1.0.2
   * Requires installing MEE K1 validator and Composability module explicitly
   */
  V1_0_0 = "1.0.0"
}

// NOTE: Update this description, whenever changing the new default version
/** Default version is 2.0.0.
 * Major release, featuring Nexus 1.2.0 with ERC-7702 support and native composability.
 * MEE K1 Validator is pre-installed as a default validator module.
 */
export const DEFAULT_MEE_VERSION: MEEVersion = MEEVersion.V2_0_0

export const ENTRY_POINT_ADDRESS: Address =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
export const ENTRYPOINT_SIMULATIONS_ADDRESS: Address =
  "0x74Cb5e4eE81b86e70f9045036a1C5477de69eE87"

export const DEFAULT_CONFIGURATIONS_BY_MEE_VERSION: Record<
  MEEVersion,
  MEEVersionConfig
> = {
  [MEEVersion.V2_1_0]: {
    // https://docs.biconomy.io/contracts-and-audits/#nexus-with-latest-mee-k1-validator
    version: MEEVersion.V2_1_0,
    accountId: "biconomy.nexus.1.2.0",
    factoryAddress: "0x0000006648ED9B2B842552BE63Af870bC74af837", // Nexus Account Factory Address
    bootStrapAddress: "0x0000003eDf18913c01cBc482C978bBD3D6E8ffA3",
    implementationAddress: "0x00000000383e8cBe298514674Ea60Ee1d1de50ac",
    validatorAddress: "0x0000000031ef4155C978d48a8A7d4EDba03b04fE", // K1 MEE Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000Afe527A978Ecb761008Af475cfF04132a1"
  },
  [MEEVersion.V2_0_0]: {
    version: MEEVersion.V2_0_0,
    accountId: "biconomy.nexus.1.2.0",
    factoryAddress: "0x000000001D1D5004a02bAfAb9de2D6CE5b7B13de", // Nexus Account Factory Address
    bootStrapAddress: "0x00000000D3254452a909E4eeD47455Af7E27C289",
    implementationAddress: "0x000000004F43C49e93C970E84001853a70923B03",
    validatorAddress: "0x00000000d12897DDAdC2044614A9677B191A2d95", // K1 MEE Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000Afe527A978Ecb761008Af475cfF04132a1"
  },
  [MEEVersion.V1_1_0]: {
    version: MEEVersion.V1_1_0,
    accountId: "biconomy.nexus.1.0.2",
    factoryAddress: "0x0000000C8B6b3329cEa5d15C9d8C15F1f254ec3C", // Nexus Account Factory Address
    bootStrapAddress: "0x000000c4781Be3349F81d341027fd7A4EdFa4Dd2",
    implementationAddress: "0x000000001964d23C59962Fc7A912872EE8fB3b6A",
    validatorAddress: "0x00000000E894100bEcFc7c934Ab7aC8FBA08A44c", // K1 MEE Validator Address
    defaultValidatorAddress: "0x00000000E894100bEcFc7c934Ab7aC8FBA08A44c", // K1 MEE Validator Address
    moduleRegistry: {
      registryAddress: zeroAddress,
      attesters: [],
      attesterThreshold: 0
    },
    composableModuleAddress: "0x000000eff5C221A6bdB12381868307c9Db5eB462",
    ethForwarderAddress: "0x000000001f1c68bD5bF69aa1cCc1d429700D41Da"
  },
  [MEEVersion.V1_0_0]: {
    version: MEEVersion.V1_0_0,
    accountId: "biconomy.nexus.1.0.2",
    factoryAddress: "0x000000c3A93d2c5E02Cb053AC675665b1c4217F9", // Nexus Account Factory Address
    bootStrapAddress: "0x879fa30248eeb693dcCE3eA94a743622170a3658",
    implementationAddress: "0x000000aC74357BFEa72BBD0781833631F732cf19",
    validatorAddress: "0x00000000d12897DDAdC2044614A9677B191A2d95", // K1 MEE Validator Address
    defaultValidatorAddress: "0x00000000d12897DDAdC2044614A9677B191A2d95", // K1 MEE Validator Address
    moduleRegistry: {
      registryAddress: zeroAddress,
      attesters: [],
      attesterThreshold: 0
    },
    composableModuleAddress: "0x00000004430bB055dB66eBef6Fe5Ee1DA9668B10",
    ethForwarderAddress: "0x000000Afe527A978Ecb761008Af475cfF04132a1"
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
