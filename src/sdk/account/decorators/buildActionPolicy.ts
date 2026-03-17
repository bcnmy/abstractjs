import { type Address, type Hex, toBytes, toHex } from "viem"
import {
  type PolicyData,
  getSpendingLimitsPolicy,
  getSudoPolicy,
  getTimeFramePolicy,
  getUniversalActionPolicy,
  getUsageLimitPolicy
} from "../../constants"
import { type LimitUsage, ParamCondition, type ParamRule } from "../../modules"
import { toBytes32 } from "../utils"

export const UniversalPolicyAbi = [
  {
    components: [
      {
        name: "valueLimitPerUse",
        type: "uint256"
      },
      {
        components: [
          {
            name: "length",
            type: "uint256"
          },
          {
            components: [
              {
                name: "condition",
                type: "uint8"
              },
              {
                name: "offset",
                type: "uint64"
              },
              {
                name: "isLimited",
                type: "bool"
              },
              {
                name: "ref",
                type: "bytes32"
              },
              {
                components: [
                  {
                    name: "limit",
                    type: "uint256"
                  },
                  {
                    name: "used",
                    type: "uint256"
                  }
                ],
                name: "usage",
                type: "tuple"
              }
            ],
            name: "rules",
            type: "tuple[16]"
          }
        ],
        name: "paramRules",
        type: "tuple"
      }
    ],
    name: "ActionConfig",
    type: "tuple"
  }
]

export type UniversalPolicyData = {
  valueLimitPerUse: bigint
  paramRules: {
    length: bigint
    rules: {
      condition: number
      offset: bigint
      isLimited: boolean
      ref: Hex
      usage: { limit: bigint; used: bigint }
    }[]
  }
}

/**
 * Sudo policy type — allows unrestricted action.
 */
export type BuildSudoActionPolicyParams = {
  type: "sudo"
}

/**
 * Universal Action Policy parameters
 * - rules: The array of parameter rules to apply per calldata parameter.
 * - valueLimitPerUse: Max value allowed for each action execution.
 */
export type BuildUniversalActionPolicyParams = {
  type: "universal"
  rules: {
    /**
     * Type of parameter comparison.
     * e.g. "equal", "greater-than", "less-than-or-equal", etc.
     */
    condition: UniversalActionPolicyConditionType
    /**
     * Offset in calldata for the parameter.
     */
    calldataOffset: bigint
    /**
     * Value to compare against (in bytes32 hex or bigint).
     */
    comparisonValue: Hex | bigint
    /**
     * Optional usage limitations for this rule.
     */
    usage?: LimitUsage
    /**
     * Whether usage is limited for this rule.
     */
    isLimited?: boolean
  }[]
  /**
   * Per-action value limit set on this policy.
   */
  valueLimitPerUse?: bigint
}

/**
 * Time Frame Policy parameters.
 * - validAfter: Unix timestamp in seconds after which valid.
 * - validUntil: Unix timestamp in seconds until which valid.
 */
export type BuildTimeFrameActionPolicyParams = {
  type: "timeframe"
  validAfter: number
  validUntil: number
}

/**
 * Usage Limit Policy parameters.
 * - limit: Maximum number of allowed usages.
 */
export type BuildUsageLimitActionPolicyParams = {
  type: "usageLimit"
  limit: bigint
}

/**
 * Spending Limits Policy parameters
 * - data: Array of per-token spending limits.
 */
export type BuildSpendingLimitsActionPolicyParams = {
  type: "spendingLimits"
  tokenLimits: { token: Address; limit: bigint }[]
}

/**
 * Abstracted Spending Limits Policy parameters
 * - data: Array of per-token spending limits.
 */
export type AbstractedBuildSpendingLimitsActionPolicyParams = {
  type: "spendingLimits"
  tokenLimits: { limit: bigint }[]
}

type BaseBuildActionPolicyParamTypes =
  | BuildSudoActionPolicyParams
  | BuildUniversalActionPolicyParams
  | BuildTimeFrameActionPolicyParams
  | BuildUsageLimitActionPolicyParams

/**
 * All abstracted action policy build types supported by this builder.
 */
export type AbstractedBuildActionPolicyParamTypes =
  | BuildSudoActionPolicyParams
  | BuildUniversalActionPolicyParams
  | BuildTimeFrameActionPolicyParams
  | BuildUsageLimitActionPolicyParams
  | AbstractedBuildSpendingLimitsActionPolicyParams

/**
 * All action policy build types supported by this builder.
 */
export type BuildActionPolicyParamTypes =
  | BaseBuildActionPolicyParamTypes
  | BuildSpendingLimitsActionPolicyParams

/**
 * Supported universal policy rule conditions.
 */
type UniversalActionPolicyConditionType =
  | "equal"
  | "notEqual"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual"

/**
 * Tuple type for a fixed-length ParamRule array (length required by ABI).
 */
export type ParamRule16 = [
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule,
  ParamRule
]

/**
 * Maps human universal condition ("equal", etc) to ParamCondition enum.
 * @param conditionType Human-readable condition string.
 * @returns ParamCondition enum value.
 */
export const getUniversalActionPolicyConditionType = (
  conditionType: UniversalActionPolicyConditionType
) => {
  let condition: ParamRule["condition"] = ParamCondition.EQUAL

  switch (conditionType) {
    case "equal":
      condition = ParamCondition.EQUAL
      break
    case "greaterThan":
      condition = ParamCondition.GREATER_THAN
      break
    case "lessThan":
      condition = ParamCondition.LESS_THAN
      break
    case "greaterThanOrEqual":
      condition = ParamCondition.GREATER_THAN_OR_EQUAL
      break
    case "lessThanOrEqual":
      condition = ParamCondition.LESS_THAN_OR_EQUAL
      break
    case "notEqual":
      condition = ParamCondition.NOT_EQUAL
      break
    default:
      condition = ParamCondition.EQUAL
      break
  }

  return condition
}

// 32 bytes calldata param value
export const calldataArgument = (value: number) => {
  if (value <= 0) {
    throw new Error("Invalid calldata argument value")
  }

  return BigInt((value - 1) * 32)
}

/**
 * Prepares data for the Universal Action Policy, including parameter rules and per-action value limits.
 */
const getUniversalPolicy = (params: BuildUniversalActionPolicyParams) => {
  const { rules, valueLimitPerUse } = params

  if (rules.length > 16) {
    throw new Error("Universal policy only supports 16 rules")
  }

  const paramRules: ParamRule[] = []

  const defaultParamRule: ParamRule = {
    condition: ParamCondition.GREATER_THAN,
    isLimited: false,
    offset: calldataArgument(1),
    ref: toHex(toBytes("0x", { size: 32 })),
    usage: { limit: BigInt(0), used: BigInt(0) }
  }

  for (let index = 0; index < 16; index++) {
    const configuredRule = rules[index]

    if (configuredRule) {
      paramRules.push({
        condition: getUniversalActionPolicyConditionType(
          configuredRule.condition
        ),
        offset: configuredRule.calldataOffset,
        ref: toBytes32(configuredRule.comparisonValue),
        isLimited: configuredRule.isLimited ?? false,
        usage: configuredRule.usage || { limit: BigInt(0), used: BigInt(0) }
      })
    } else {
      paramRules.push(defaultParamRule)
    }
  }

  return getUniversalActionPolicy({
    paramRules: {
      length: BigInt(rules.length),
      rules: paramRules as ParamRule16
    },
    valueLimitPerUse: valueLimitPerUse || 0n
  })
}

/**
 * Builds and returns the appropriate action policy based on the provided parameters (type and data).
 */
export const buildActionPolicy = (
  parameters: BuildActionPolicyParamTypes
): PolicyData => {
  const { type } = parameters

  switch (type) {
    case "sudo": {
      return getSudoPolicy()
    }
    case "universal": {
      return getUniversalPolicy(parameters)
    }
    case "timeframe": {
      return getTimeFramePolicy({
        validAfter: parameters.validAfter,
        validUntil: parameters.validUntil
      })
    }
    case "usageLimit": {
      return getUsageLimitPolicy({ limit: parameters.limit })
    }
    case "spendingLimits": {
      return getSpendingLimitsPolicy(parameters.tokenLimits)
    }
    default: {
      throw new Error(`Unknown build action policy type: ${type}`)
    }
  }
}
