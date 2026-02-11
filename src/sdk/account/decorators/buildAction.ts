import {
  type Address,
  type Hex,
  erc20Abi,
  getAbiItem,
  isAddress,
  toFunctionSelector
} from "viem"
import {
  type BuildActionPolicyTypes,
  buildActionPolicy,
  calldataArgument
} from "./buildActionPolicy"
import { ActionData, PolicyData } from "../../constants"

export type SessionAction = {
  actions: ActionData[]
  chainId: number
}

/**
 * Common base parameters for all build actions.
 * @property chainIds - Set of chain IDs this action applies to.
 * @property contractAddress - The address of the contract to target.
 * @property policies - (optional) Policy constraints for action validation/execution.
 */
type BaseBuildActionParams = {
  chainIds: number[]
  contractAddress: Address
  policies?: BuildActionPolicyTypes[]
}

/** Build 'transfer' ERC20 action. */
export type BuildTransferAction = {
  type: "transfer"
  data: BaseBuildActionParams
}

/** Build 'transferFrom' ERC20 action. */
export type BuildTransferFromAction = {
  type: "transferFrom"
  data: BaseBuildActionParams
}

/** Build 'approve' ERC20 action. */
export type BuildApproveAction = {
  type: "approve"
  data: BaseBuildActionParams
}

/**
 * Build ERC20 spending limit action.
 * @property recipientAddress - (optional) Restrict recipient.
 * @property limitPerAction - (optional) Limit per action.
 * @property maxLimit - (optional) Max session spending.
 */
export type BuildERC20SpendingLimitAction = {
  type: "erc20SpendingLimit"
  data: Omit<BaseBuildActionParams, "policies"> & {
    recipientAddress?: Address
    limitPerAction?: bigint
    maxLimit?: bigint
  }
}

/**
 * Build custom action for arbitrary contract/function call.
 */
export type BuildCustomAction = {
  type: "custom"
  data: BaseBuildActionParams & {
    functionSignature: Hex
  }
}

/**
 * Build batch action for batching the existing session actions
 */
export type BuildBatchActions = {
  type: "batch"
  data: {
    actions: SessionAction[]
  }
}

export type BuildActionTypes =
  | BuildTransferAction
  | BuildTransferFromAction
  | BuildApproveAction
  | BuildERC20SpendingLimitAction
  | BuildCustomAction
  | BuildBatchActions

const resolvePoliciesOrApplyUnrestrictedPolicy = (
  policies?: BuildActionPolicyTypes[]
): PolicyData[] => {
  const actionPolicies =
    policies && policies.length > 0
      ? policies.map((policy) => {
          return buildActionPolicy(policy)
        })
      : [buildActionPolicy({ type: "sudo" })]

  return actionPolicies
}

export const buildAction = (parameters: BuildActionTypes): SessionAction[] => {
  const { type, data } = parameters

  switch (type) {
    case "transfer": {
      const functionSignature = toFunctionSelector(
        getAbiItem({ abi: erc20Abi, name: "transfer" })
      )

      const actionPolicies = resolvePoliciesOrApplyUnrestrictedPolicy(
        data.policies
      )

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

      const actionPolicies = resolvePoliciesOrApplyUnrestrictedPolicy(
        data.policies
      )

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

      const actionPolicies = resolvePoliciesOrApplyUnrestrictedPolicy(
        data.policies
      )

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
    case "erc20SpendingLimit": {
      const { recipientAddress, limitPerAction, maxLimit } = data

      const functionSignature = toFunctionSelector(
        getAbiItem({ abi: erc20Abi, name: "transfer" })
      )

      const policies: PolicyData[] = []

      // Restrict recipient if provided, using a universal policy checking calldata offset 0
      if (recipientAddress && isAddress(recipientAddress)) {
        const recipientCheckPolicy = buildActionPolicy({
          type: "universal",
          rules: [
            {
              condition: "equal",
              calldataOffset: calldataArgument(1),
              comparisonValue: recipientAddress
            }
          ]
        })

        policies.push(recipientCheckPolicy)
      }

      // Restrict by per-action amount using a spendingLimits policy if no maxLimit
      if (limitPerAction && !maxLimit) {
        // Per action limit will be enforced (old version—using "spendingLimits")
        const spendingLimitPolicy = buildActionPolicy({
          type: "spendingLimits",
          tokenLimits: [
            {
              token: data.contractAddress,
              limit: limitPerAction
            }
          ]
        })

        policies.push(spendingLimitPolicy)
      }
      // If a session maximum is specified, use a universal policy w/ enforced usage
      else if (maxLimit) {
        // Both per-action and max per session limit enforced in one universal policy
        const spendingLimitUniversalPolicy = buildActionPolicy({
          type: "universal",
          rules: [
            {
              condition: "lessThanOrEqual",
              calldataOffset: calldataArgument(2),
              comparisonValue: limitPerAction || maxLimit,
              isLimited: true,
              usage: { limit: maxLimit, used: 0n }
            }
          ]
        })

        policies.push(spendingLimitUniversalPolicy)
      }

      return data.chainIds.map((chainId) => {
        return {
          actions: [
            {
              actionTarget: data.contractAddress,
              actionTargetSelector: functionSignature,
              actionPolicies: policies
            }
          ],
          chainId
        }
      })
    }
    case "custom": {
      const actionPolicies = resolvePoliciesOrApplyUnrestrictedPolicy(
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
