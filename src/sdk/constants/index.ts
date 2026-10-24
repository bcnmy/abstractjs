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
  /**
   * Mee k1 validator deprecated and replaced with Stx Validator
   * Attention: Stx data packing into the signature for Permit mode has changed.
   **/
  V3_0_0 = "3.0.0",
  /**
   *  New K1 Validator with Safe SA as master account support
   **/
  V2_3_0 = "2.3.0",
  /**
   * Nexus 1.3.3
   * - Composability 1.1.1
   * - Account initialization is single-use per transaction
   **/
  V2_2_3 = "2.2.3",
  /**
   * Nexus 1.3.2
   * - Composability 1.1.1
   * - New composability features - signed integer and OR flow
   **/
  V2_2_2 = "2.2.2",
  /**
   * Nexus 1.3.1
   * - Composability 1.1.0
   * - 7702 accounts initialization with eoa's signature (relayers' support)
   * - EIP-712 signing support for `simple` (smart-account) mode
   **/
  V2_2_1 = "2.2.1",

  /** New K1 Mee module introduced that allows ERC-7702-delegated EOAs owning Nexus accounts. */
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

export enum ComposabilityVersion {
  /** Added signed integer and OR flow */
  V1_1_1 = "1.1.1",
  /** Added native token runtime injection support. */
  V1_1_0 = "1.1.0",
  /** First release for the Composability contracts suite. */
  V1_0_0 = "1.0.0"
}

/**
 * MEE versions approved for creating new accounts.
 *
 * Membership is decided per implementation bytecode, not by version ordering.
 * Version numbers do not imply membership: 2.3.0 and 3.0.0 sort above 2.2.3 but
 * are built on Nexus 1.3.1, so they are not listed here. Add a version only after
 * its deployed implementation has been verified on chain.
 */
export const SAFE_MEE_VERSIONS = [MEEVersion.V2_2_3] as const

/** A MEE version that may be used to create new accounts. */
export type SafeMEEVersion = (typeof SAFE_MEE_VERSIONS)[number]

/**
 * A MEE version that may no longer be used to create new accounts.
 *
 * These remain reachable through {@link getLegacyMEEVersion} because deriving an
 * existing account's address requires the version it was created with. Deploying,
 * sweeping or upgrading an existing account all depend on that derivation.
 */
export type LegacyMEEVersion = Exclude<MEEVersion, SafeMEEVersion>

// NOTE: Update this description, whenever changing the new default version
/** Default version is 2.2.3.
 * Nexus 1.3.3, Composability 1.1.1. Account initialization is single-use per transaction.
 *
 * Prefer selecting a version explicitly; this default exists for internal fallbacks.
 */
export const DEFAULT_MEE_VERSION: SafeMEEVersion = MEEVersion.V2_2_3

export const ENTRY_POINT_ADDRESS: Address =
  "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
export const ENTRYPOINT_SIMULATIONS_ADDRESS: Address =
  "0x74Cb5e4eE81b86e70f9045036a1C5477de69eE87"

export const DEFAULT_CONFIGURATIONS_BY_MEE_VERSION: Record<
  MEEVersion,
  MEEVersionConfig
> = {
  [MEEVersion.V3_0_0]: {
    version: MEEVersion.V3_0_0,
    accountId: "biconomy.nexus.1.3.1",
    factoryAddress: "0x75Eb8D1621D193010425D34b4Ae81835E2409660",
    bootStrapAddress: "0x33A8F72F236e02eD62B0312f48105AcBD651Cd17",
    implementationAddress: "0x37DF3014c8B72372F2783aAF517bcdC6B516c8Df",
    validatorAddress: "0x5e2181ccC1550f5e86F14298A12a7a9A04536F58", // Stx Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000C48Cdf2b46bEc062483dBD27046dfE3b8d",
    composabilityVersion: ComposabilityVersion.V1_1_0,
    submodules: {
      noStxModeVerifier: "0x03043fA2956d7729708E5871006E4D60f077BF9C",
      SimpleModeSubmodule: "0x3dE6bd76AB8B77fc9E4b79168EaF2253Ff1F0410",
      PermitSubmodule: "0x2eb293D700dEeaF923f6ff32741921C270Ff339b",
      TxSubmodule: "0xBFf2aE0e9B523E8192A77c0Dd610b490eC45A08c",
      SafeAccountSubmodule: "0xa35a716E8e1Df5Fb441bCDdC2357cf9b256AC566",
      EoaStatelessValidator: "0xdD900Cd95f072eAe396bE0487C2546Bf81d01B48",
      P256StatelessValidator: "0xa7B97e8152aCee107a098F95f691Cd24Cf2f9835"
    }
  },
  [MEEVersion.V2_3_0]: {
    version: MEEVersion.V2_3_0,
    accountId: "biconomy.nexus.1.3.1",
    factoryAddress: "0x5836Bdb35913c7CBA6ef40675354445121449917",
    bootStrapAddress: "0xCa8f48912A3a33fE694c318a1d097AD394CFAB76",
    implementationAddress: "0x54F220e4f0DEAb58Be26153df5a674668B9d7Fb2",
    validatorAddress: "0x1Cdae7dcc3f32551865EfE3d77AC2b88Ee2905B4",
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000C48Cdf2b46bEc062483dBD27046dfE3b8d",
    composabilityVersion: ComposabilityVersion.V1_1_0
  },
  [MEEVersion.V2_2_3]: {
    version: MEEVersion.V2_2_3,
    accountId: "biconomy.nexus.1.3.3",
    factoryAddress: "0x0000b1C08f1418dA76B5E99c1Bf5718486cf8c53", // Nexus Account Factory Address
    bootStrapAddress: "0x0000B1c0A80cb7DD166a15e7390b8A4Ced4500C6",
    implementationAddress: "0x0000B1c01cB3b5770D8806f0D214d50131a08a5B", // Nexus 1.3.3
    validatorAddress: "0x0000B1C0790E5a28293276C320d2B95D651dBaD6", // MEE K1 Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x0000B1C0Fc7015Effa85892426FAEd8211B2d62E",
    composabilityVersion: ComposabilityVersion.V1_1_1
  },
  [MEEVersion.V2_2_2]: {
    version: MEEVersion.V2_2_2,
    accountId: "biconomy.nexus.1.3.2",
    factoryAddress: "0x0000B1c0dCFd64dfe8FeC844923B653DD0dfdB05", // Nexus Account Factory Address
    bootStrapAddress: "0x0000B1c0A80cb7DD166a15e7390b8A4Ced4500C6",
    implementationAddress: "0x0000b1C0B95DA04652C1919667D1DCC14f46f62B", // Nexus 1.3.2
    validatorAddress: "0x0000B1C0790E5a28293276C320d2B95D651dBaD6", // MEE K1 Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x0000B1C0Fc7015Effa85892426FAEd8211B2d62E",
    composabilityVersion: ComposabilityVersion.V1_1_1
  },
  [MEEVersion.V2_2_1]: {
    version: MEEVersion.V2_2_1,
    accountId: "biconomy.nexus.1.3.1",
    factoryAddress: "0x000000002c9A405a196f2dc766F2476B731693c3", // Nexus Account Factory Address
    bootStrapAddress: "0x000000007BfEdA33ac982cb38eAaEf5D7bCC954c",
    implementationAddress: "0x0000000020fe2F30453074aD916eDeB653eC7E9D", // Nexus 1.3.1
    validatorAddress: "0x0000000002d3cC5642A748B6783F32C032616E03", // MEE K1 Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000C48Cdf2b46bEc062483dBD27046dfE3b8d",
    composabilityVersion: ComposabilityVersion.V1_1_0
  },
  [MEEVersion.V2_1_0]: {
    version: MEEVersion.V2_1_0,
    accountId: "biconomy.nexus.1.2.0",
    factoryAddress: "0x0000006648ED9B2B842552BE63Af870bC74af837", // Nexus Account Factory Address
    bootStrapAddress: "0x0000003eDf18913c01cBc482C978bBD3D6E8ffA3",
    implementationAddress: "0x00000000383e8cBe298514674Ea60Ee1d1de50ac",
    validatorAddress: "0x0000000031ef4155C978d48a8A7d4EDba03b04fE", // K1 MEE Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000Afe527A978Ecb761008Af475cfF04132a1",
    composabilityVersion: ComposabilityVersion.V1_0_0
  },
  [MEEVersion.V2_0_0]: {
    version: MEEVersion.V2_0_0,
    accountId: "biconomy.nexus.1.2.0",
    factoryAddress: "0x000000001D1D5004a02bAfAb9de2D6CE5b7B13de", // Nexus Account Factory Address
    bootStrapAddress: "0x00000000D3254452a909E4eeD47455Af7E27C289",
    implementationAddress: "0x000000004F43C49e93C970E84001853a70923B03",
    validatorAddress: "0x00000000d12897DDAdC2044614A9677B191A2d95", // K1 MEE Validator Address
    defaultValidatorAddress: zeroAddress,
    ethForwarderAddress: "0x000000Afe527A978Ecb761008Af475cfF04132a1",
    composabilityVersion: ComposabilityVersion.V1_0_0
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
    ethForwarderAddress: "0x000000001f1c68bD5bF69aa1cCc1d429700D41Da",
    composabilityVersion: ComposabilityVersion.V1_0_0
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
    ethForwarderAddress: "0x000000Afe527A978Ecb761008Af475cfF04132a1",
    composabilityVersion: ComposabilityVersion.V1_0_0
  }
}

/**
 * The Nexus EIP-712 domain version string for a given MEE version (or its
 * already-resolved config).
 *
 * Each `MEEVersionConfig.accountId` is formatted as `biconomy.nexus.<X.Y.Z>` —
 * the same string the on-chain Nexus contract returns from
 * `_domainNameAndVersion()`. This helper strips the prefix and returns the
 * version suffix, giving callers a reliable fallback when an on-chain
 * `eip712Domain()` query is unavailable (e.g. for a counterfactual SCA whose
 * factory hasn't been deployed yet).
 *
 * @example
 * getNexusDomainVersion(MEEVersion.V2_2_2)         // → "1.3.2"
 * getNexusDomainVersion(getMEEVersion(MEEVersion.V2_1_0)) // → "1.2.0"
 */
export const getNexusDomainVersion = (
  meeVersionOrConfig: MEEVersion | MEEVersionConfig
): string => {
  const config =
    typeof meeVersionOrConfig === "string"
      ? DEFAULT_CONFIGURATIONS_BY_MEE_VERSION[meeVersionOrConfig]
      : meeVersionOrConfig
  if (!config) {
    throw new Error(
      `Unsupported MEE version: ${String(meeVersionOrConfig)}. ` +
        `Expected one of: ${Object.keys(DEFAULT_CONFIGURATIONS_BY_MEE_VERSION).join(", ")}`
    )
  }
  const prefix = "biconomy.nexus."
  if (!config.accountId.startsWith(prefix)) {
    throw new Error(
      `Unexpected accountId format: "${config.accountId}". ` +
        `Expected "${prefix}<X.Y.Z>".`
    )
  }
  return config.accountId.slice(prefix.length)
}

// Rhinestone constants
export {
  SMART_SESSIONS_ADDRESS,
  OWNABLE_VALIDATOR_ADDRESS,
  OWNABLE_EXECUTOR_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS,
  REGISTRY_ADDRESS,
  type AccountType,
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
  getPermissionId,
  getEnableSessionDetails,
  getSmartSessionsValidator,
  getSudoPolicy,
  getSpendingLimitsPolicy,
  getUsageLimitPolicy,
  getValueLimitPolicy,
  getOwnableValidator,
  getUniversalActionPolicy,
  getTimeFramePolicy
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
