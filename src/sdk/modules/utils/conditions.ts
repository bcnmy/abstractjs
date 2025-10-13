import {
  type Abi,
  type Address,
  encodeAbiParameters,
  encodeFunctionData
} from "viem"
import type { AnyData } from "./Types"
import {
  type ConstraintField,
  type InputParam,
  InputParamFetcherType,
  equalTo,
  greaterThanOrEqualTo,
  lessThanOrEqualTo,
  prepareInputParam,
  validateAndProcessConstraints
} from "./composabilityCalls"

/**
 * Enum for condition constraint types
 */
export enum ConditionType {
  /** Greater than or equal to */
  GTE = "gte",
  /** Less than or equal to */
  LTE = "lte",
  /** Equal to */
  EQ = "eq"
}

/**
 * Defines a condition that must be satisfied for the composable call to execute.
 * Conditions are evaluated via STATIC_CALL operations before the main function execution.
 * If any condition fails, the entire transaction reverts.
 *
 * @property targetContract - Contract address to call for condition evaluation
 * @property functionAbi - ABI of the contract containing the condition function
 * @property functionName - Name of the view/pure function to call
 * @property args - Arguments to pass to the condition function
 * @property constraint - Constraint to apply to the function result (GTE, LTE, EQ)
 * @property description - Optional human-readable description for debugging
 *
 * @example
 * // Check minimum token balance
 * {
 *   targetContract: usdcAddress,
 *   functionAbi: erc20Abi,
 *   functionName: "balanceOf",
 *   args: [userAddress],
 *   constraint: greaterThanOrEqualTo(1000n),
 *   description: "Minimum USDC balance: 1000"
 * }
 */
export type ExecutionCondition = {
  targetContract: Address
  functionAbi: Abi
  functionName: string
  args: Array<AnyData>
  constraint: ConstraintField
  description?: string
}

/**
 * Creates an InputParam for a condition using STATIC_CALL fetcher type.
 * The resulting InputParam will be appended to the function's regular parameters.
 *
 * @param condition - The condition to convert to an InputParam
 * @returns InputParam configured for STATIC_CALL with constraint validation
 *
 * @internal
 */
export const createConditionInputParam = (
  condition: ExecutionCondition
): InputParam => {
  // Encode the static call: (address, bytes)
  const encodedParam = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [
      condition.targetContract,
      encodeFunctionData({
        abi: condition.functionAbi,
        functionName: condition.functionName,
        args: condition.args
      })
    ]
  )

  // Process constraint into smart contract format
  const constraintsToAdd = validateAndProcessConstraints([condition.constraint])

  return prepareInputParam(
    InputParamFetcherType.STATIC_CALL,
    encodedParam,
    constraintsToAdd
  )
}

/**
 * Creates a condition with the specified constraint type and value.
 * This is the unified helper function used by all condition builders.
 *
 * @param params - Condition parameters
 * @param params.targetContract - Contract to call
 * @param params.functionAbi - ABI containing the function
 * @param params.functionName - Function to call
 * @param params.args - Function arguments
 * @param params.value - The value to compare against (threshold or expected value)
 * @param params.type - The constraint type (GTE, LTE, or EQ)
 * @param params.description - Optional description
 * @returns Configured condition
 *
 * @example
 * ```typescript
 * const condition = createCondition({
 *   targetContract: tokenAddress,
 *   functionAbi: erc20Abi,
 *   functionName: "balanceOf",
 *   args: [userAddress],
 *   value: 1000n,
 *   type: ConditionType.GTE
 * })
 * ```
 */
export const createCondition = (params: {
  targetContract: Address
  functionAbi: Abi
  functionName: string
  args: Array<AnyData>
  value: bigint
  type: ConditionType
  description?: string
}): ExecutionCondition => {
  // Map ConditionType enum to the appropriate constraint function
  const constraintMap = {
    [ConditionType.GTE]: greaterThanOrEqualTo,
    [ConditionType.LTE]: lessThanOrEqualTo,
    [ConditionType.EQ]: equalTo
  }

  return {
    targetContract: params.targetContract,
    functionAbi: params.functionAbi,
    functionName: params.functionName,
    args: params.args,
    constraint: constraintMap[params.type](params.value),
    description: params.description
  }
}
