import { type Address, encodeFunctionData, erc20Abi } from "viem"
import type {
  AbstractCall,
  Instruction,
  Trigger
} from "../../../clients/decorators/mee"
import type { AnyData } from "../../../modules/utils/Types"
import { isComposableCallRequired } from "../../../modules/utils/composabilityCalls"
import { getFunctionContextFromAbi } from "../../../modules/utils/runtimeAbiEncoding"
import type { BaseInstructionsParams } from "../build"
import {
  type BuildComposableParameters,
  buildComposableCall
} from "./buildComposable"

/**
 * Parameters for building an approval instruction
 */
export type BuildApproveParameters = Trigger & {
  /**
   * Gas limit for the approval transaction. Required when using the standard
   * approve function instead of permit.
   * @example 50000n
   */
  gasLimit?: bigint
  /**
   * Spender address.
   * @example "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
   */
  spender: Address
}

/**
 * Parameters for the buildApprove function
 */
export type BuildApproveParams = BaseInstructionsParams & {
  /**
   * Parameters specific to the approval instruction
   * @see {@link BuildApproveParameters}
   */
  parameters: BuildApproveParameters
}

/**
 * Builds an instruction for approving token spending. This is typically used
 * when the token doesn't support ERC20Permit and a standard approve transaction
 * is needed.
 *
 * @param baseParams - Base configuration for the instruction
 * @param baseParams.account - The account that will execute the approval
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - Parameters for the approval
 * @param parameters.chainId - Chain ID where the approval will be executed
 * @param parameters.tokenAddress - Address of the token to approve
 * @param parameters.amount - Amount to approve
 * @param [parameters.gasLimit] - Optional gas limit for the approval
 * @param [parameters.spender] - Optional spender address
 *
 * @returns Promise resolving to array of instructions
 *
 * @example
 * ```typescript
 * const instructions = await buildApprove(
 *   { account: myMultichainAccount },
 *   {
 *     chainId: 1,
 *     tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     amount: 1000000n, // 1 USDC
 *     gasLimit: 50000n,
 *     spender: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *   }
 * );
 * ```
 */
export const buildApprove = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildApproveParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const { chainId, tokenAddress, amount, gasLimit, spender } = parameters

  const abi = erc20Abi
  const functionSig = "approve"
  const args: readonly [`0x${string}`, bigint] = [spender, amount]

  const functionContext = getFunctionContextFromAbi(functionSig, abi)

  // Check for the runtime arguments and detect the need for composable call
  const isComposableCall = isComposableCallRequired(
    functionContext,
    args as unknown as Array<AnyData>
  )

  let triggerCall: AbstractCall

  // If the composable call is detected ? The call needs to composed with runtime encoding
  if (isComposableCall) {
    const composableCallParams: BuildComposableParameters = {
      to: tokenAddress,
      params: {
        type: functionSig,
        data: {
          args: args as unknown as Array<AnyData>
        }
      },
      abi,
      chainId,
      gasLimit
    }

    triggerCall = await buildComposableCall(baseParams, composableCallParams)
  } else {
    triggerCall = {
      to: tokenAddress,
      data: encodeFunctionData({
        abi,
        functionName: functionSig,
        args
      }),
      ...(gasLimit ? { gasLimit } : {})
    }
  }

  return [
    ...currentInstructions,
    {
      calls: [triggerCall],
      chainId
    }
  ]
}

export default buildApprove
