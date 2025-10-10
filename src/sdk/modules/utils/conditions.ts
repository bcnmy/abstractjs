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
export type ConditionalExecutionCondition = {
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
  condition: ConditionalExecutionCondition
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
 * Namespace for condition builder functions.
 * Provides a clean, discoverable API for creating common condition types.
 *
 * @example
 * ```typescript
 * import { condition } from '@biconomy/abstractjs'
 *
 * const minBalanceCondition = condition.greaterThan({
 *   targetContract: tokenAddress,
 *   functionAbi: erc20Abi,
 *   functionName: "balanceOf",
 *   args: [userAddress],
 *   threshold: 1000n
 * })
 * ```
 */
export const condition = {
  /**
   * Creates a greater-than-or-equal condition.
   * The condition passes if: result >= threshold
   *
   * @param params - Condition parameters
   * @param params.targetContract - Contract to call
   * @param params.functionAbi - ABI containing the function
   * @param params.functionName - Function to call
   * @param params.args - Function arguments
   * @param params.threshold - Minimum value required (inclusive)
   * @param params.description - Optional description
   * @returns Configured condition
   */
  greaterThan: (params: {
    targetContract: Address
    functionAbi: Abi
    functionName: string
    args: Array<AnyData>
    threshold: bigint
    description?: string
  }): ConditionalExecutionCondition => ({
    targetContract: params.targetContract,
    functionAbi: params.functionAbi,
    functionName: params.functionName,
    args: params.args,
    constraint: greaterThanOrEqualTo(params.threshold),
    description: params.description
  }),

  /**
   * Creates a less-than-or-equal condition.
   * The condition passes if: result <= threshold
   *
   * @param params - Condition parameters
   * @param params.targetContract - Contract to call
   * @param params.functionAbi - ABI containing the function
   * @param params.functionName - Function to call
   * @param params.args - Function arguments
   * @param params.threshold - Maximum value allowed (inclusive)
   * @param params.description - Optional description
   * @returns Configured condition
   */
  lessThan: (params: {
    targetContract: Address
    functionAbi: Abi
    functionName: string
    args: Array<AnyData>
    threshold: bigint
    description?: string
  }): ConditionalExecutionCondition => ({
    targetContract: params.targetContract,
    functionAbi: params.functionAbi,
    functionName: params.functionName,
    args: params.args,
    constraint: lessThanOrEqualTo(params.threshold),
    description: params.description
  }),

  /**
   * Creates an equality condition.
   * The condition passes if: result == expectedValue
   *
   * @param params - Condition parameters
   * @param params.targetContract - Contract to call
   * @param params.functionAbi - ABI containing the function
   * @param params.functionName - Function to call
   * @param params.args - Function arguments
   * @param params.expectedValue - Expected value for equality check
   * @param params.description - Optional description
   * @returns Configured condition
   */
  equalTo: (params: {
    targetContract: Address
    functionAbi: Abi
    functionName: string
    args: Array<AnyData>
    expectedValue: bigint
    description?: string
  }): ConditionalExecutionCondition => ({
    targetContract: params.targetContract,
    functionAbi: params.functionAbi,
    functionName: params.functionName,
    args: params.args,
    constraint: equalTo(params.expectedValue),
    description: params.description
  })
}
