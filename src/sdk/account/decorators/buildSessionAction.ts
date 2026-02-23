import {
  type Address,
  type Hex,
  type OneOf,
  erc20Abi,
  getAbiItem,
  isAddress,
  toFunctionSelector
} from "viem"
import type { ActionData, PolicyData } from "../../constants"
import {
  type AbstractedBuildActionPolicyParamTypes,
  type BuildActionPolicyParamTypes,
  type BuildUniversalActionPolicyParams,
  buildActionPolicy,
  calldataArgument
} from "./buildActionPolicy"

export type SessionAction = {
  actions: ActionData[]
  chainId: number
}

export type SessionActionLike = SessionAction | SessionAction[]

export const resolveSessionActions = (
  sessionActions: SessionActionLike[]
): SessionAction[] => {
  return sessionActions.flat()
}

/**
 * Common base parameters for all ERC20 build session actions.
 * @property chainIds - Set of chain IDs this action applies to.
 * @property contractAddress - The address of the contract to target.
 * @property recipientAddress - (optional) Restrict transfers to a specific recipient address.
 * @property amountLimitPerAction - (optional) Limit the maximum amount per transaction.
 * @property maxAmountLimit - (optional) Restrict the maximum cumulative amount allowed.
 * @property usageLimit - (optional) Limit the number of times this action can be performed.
 * @property validAfter - (optional) Unix timestamp (seconds) after which the action is valid.
 * @property validUntil - (optional) Unix timestamp (seconds) until which the action is valid.
 * @property policies - (optional) Policy constraints for action validation/execution.
 */
type BaseBuildSessionERC20ActionParams = {
  chainIds: number[]
  contractAddress: Address
} & OneOf<
  | {
      recipientAddress?: Address
      amountLimitPerAction?: bigint
      maxAmountLimit?: bigint
      usageLimit?: bigint
      validAfter?: number
      validUntil?: number
    }
  | {
      policies: AbstractedBuildActionPolicyParamTypes[] | PolicyData[]
    }
>

/** Build 'transfer' ERC20 session action. */
export type BuildSessionTransferActionParams = {
  type: "transfer"
  data: BaseBuildSessionERC20ActionParams
}

/** Build 'transferFrom' ERC20 session action. */
export type BuildSessionTransferFromActionParams = {
  type: "transferFrom"
  data: BaseBuildSessionERC20ActionParams
}

/** Build 'approve' ERC20 session action. */
export type BuildSessionApproveActionParams = {
  type: "approve"
  data: BaseBuildSessionERC20ActionParams
}

/**
 * Build custom action for arbitrary contract/function call.
 */
export type BuildSessionCustomAction = {
  type: "custom"
  data: {
    chainIds: number[]
    contractAddress: Address
    functionSignature: Hex
    policies?: AbstractedBuildActionPolicyParamTypes[] | PolicyData[]
  }
}

/**
 * Build batch action for batching the existing session actions
 */
export type BuildBatchSessionActions = {
  type: "batch"
  data: {
    actions: SessionAction[]
  }
}

export type BuildSessionActionTypes =
  | BuildSessionTransferActionParams
  | BuildSessionTransferFromActionParams
  | BuildSessionApproveActionParams
  | BuildSessionCustomAction
  | BuildBatchSessionActions

const resolvePoliciesOrApplyUnrestrictedPolicy = (
  contractAddress: Address,
  policies?: AbstractedBuildActionPolicyParamTypes[] | PolicyData[]
): PolicyData[] => {
  const actionPolicies =
    policies && policies.length > 0
      ? policies.map(
          (policy: AbstractedBuildActionPolicyParamTypes | PolicyData) => {
            // If it's a PolicyData object (already built), return as is
            if ("policy" in policy && "initData" in policy) {
              return policy as PolicyData
            }

            if (policy.type === "spendingLimits") {
              const updatedPolicy: BuildActionPolicyParamTypes = {
                ...policy,
                tokenLimits: policy.tokenLimits.map((tokenLimit) => ({
                  token: contractAddress,
                  limit: tokenLimit.limit
                }))
              }

              return buildActionPolicy(updatedPolicy)
            }

            // If it's a builder type, build into PolicyData
            return buildActionPolicy(policy as BuildActionPolicyParamTypes)
          }
        )
      : [buildActionPolicy({ type: "sudo" })]

  return actionPolicies
}

const preparePoliciesForERC20Actions = (
  params: BaseBuildSessionERC20ActionParams,
  recipientAddressPosition: number,
  amountPosition: number
) => {
  // If there are dev defined policies, it will be processed and returned immediately
  if (params.policies && params.policies.length > 0) {
    return resolvePoliciesOrApplyUnrestrictedPolicy(
      params.contractAddress,
      params.policies
    )
  }

  let actionsPolicies: PolicyData[] = []

  const {
    recipientAddress,
    usageLimit,
    amountLimitPerAction,
    maxAmountLimit,
    validAfter,
    validUntil
  } = params

  const rules: BuildUniversalActionPolicyParams["rules"] = []

  // Restrict recipient if provided, using a universal policy by checking calldata offset 0
  if (recipientAddress && isAddress(recipientAddress)) {
    rules.push({
      condition: "equal",
      calldataOffset: calldataArgument(recipientAddressPosition),
      comparisonValue: recipientAddress
    })
  }

  // Restrict by per-action amount using a universal policy by checking calldata offset 32 with cummulative tracking
  if (maxAmountLimit) {
    rules.push({
      condition: "lessThanOrEqual",
      calldataOffset: calldataArgument(amountPosition),
      comparisonValue: amountLimitPerAction || maxAmountLimit,
      isLimited: true,
      usage: { limit: maxAmountLimit, used: 0n }
    })
  } else {
    if (amountLimitPerAction) {
      // Restrict by per-action amount using a universal policy by checking calldata offset 32 without cummulative tracking
      if (amountLimitPerAction) {
        rules.push({
          condition: "lessThanOrEqual",
          calldataOffset: calldataArgument(amountPosition),
          comparisonValue: amountLimitPerAction
        })
      }
    }
  }

  if (rules.length > 0) {
    const universalPolicy = buildActionPolicy({
      type: "universal",
      rules
    })

    actionsPolicies.push(universalPolicy)
  }

  // Restrict by per-action usage limit
  if (usageLimit) {
    actionsPolicies.push(
      buildActionPolicy({
        type: "usageLimit",
        limit: usageLimit
      })
    )
  }

  // Restrict by per-action time range limit
  if (validAfter || validUntil) {
    // In unix timestamp (Seconds)
    const currentTime = Math.floor(Date.now() / 1000)
    const oneDayInSecs = 60 * 60 * 24

    actionsPolicies.push(
      buildActionPolicy({
        type: "timeframe",
        validAfter: validAfter || currentTime,
        validUntil: validUntil || (validAfter || currentTime) + oneDayInSecs
      })
    )
  }

  // If no policies are configured, sudo policy will be added by default which is a unrestricted policy
  if (actionsPolicies.length === 0) {
    actionsPolicies = [buildActionPolicy({ type: "sudo" })]
  }

  return actionsPolicies
}

export const buildSessionAction = (
  parameters: BuildSessionActionTypes
): SessionAction[] => {
  const { type, data } = parameters

  switch (type) {
    case "transfer": {
      const functionSignature = toFunctionSelector(
        getAbiItem({ abi: erc20Abi, name: "transfer" })
      )

      const actionPolicies = preparePoliciesForERC20Actions(data, 1, 2)

      return data.chainIds.map((chainId) => {
        return {
          actions: [
            {
              actionTarget: data.contractAddress,
              actionTargetSelector: functionSignature,
              actionPolicies
            }
          ],
          chainId
        }
      })
    }
    case "transferFrom": {
      const functionSignature = toFunctionSelector(
        getAbiItem({ abi: erc20Abi, name: "transferFrom" })
      )

      const actionPolicies = preparePoliciesForERC20Actions(data, 2, 3)

      return data.chainIds.map((chainId) => {
        return {
          actions: [
            {
              actionTarget: data.contractAddress,
              actionTargetSelector: functionSignature,
              actionPolicies
            }
          ],
          chainId
        }
      })
    }
    case "approve": {
      const functionSignature = toFunctionSelector(
        getAbiItem({ abi: erc20Abi, name: "approve" })
      )

      const actionPolicies = preparePoliciesForERC20Actions(data, 1, 2)

      return data.chainIds.map((chainId) => {
        return {
          actions: [
            {
              actionTarget: data.contractAddress,
              actionTargetSelector: functionSignature,
              actionPolicies
            }
          ],
          chainId
        }
      })
    }
    case "custom": {
      const actionPolicies = resolvePoliciesOrApplyUnrestrictedPolicy(
        data.contractAddress,
        data.policies
      )

      return data.chainIds.map((chainId) => {
        return {
          actions: [
            {
              actionTarget: data.contractAddress,
              actionTargetSelector: data.functionSignature,
              actionPolicies
            }
          ],
          chainId
        }
      })
    }
    case "batch": {
      if (data.actions.length < 2) {
        throw new Error("A Batch must contain at least 2 actions")
      }

      if (
        data.actions.some(
          ({ chainId }) => Number(chainId) !== Number(data.actions[0].chainId)
        )
      ) {
        throw new Error("All actions must be on the same chain")
      }

      const batchedActions = data.actions.flatMap(({ actions }) => actions)

      return [
        {
          actions: batchedActions,
          chainId: data.actions[0].chainId
        }
      ]
    }
    /**
     * Defensive: Unrecognized type, throw an explicit error.
     */
    default: {
      throw new Error(`Unknown build action type: ${type}`)
    }
  }
}
