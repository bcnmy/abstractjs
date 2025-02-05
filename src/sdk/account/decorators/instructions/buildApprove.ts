import { type Address, encodeFunctionData, erc20Abi } from "viem"
import type {
  AbstractCall,
  Instruction,
  Trigger
} from "../../../clients/decorators/mee"
import type { BaseInstructionsParams } from "../build"

export type BuildApproveParameters = Trigger & {
  /**
   * Permit mode will use the approve function, which requires a gas limit
   */
  gasLimit?: bigint
  /**
   * The spender of the token
   */
  spender?: Address
}

/**
 * Builds a trigger instruction for an approval
 * @param baseParams - {@link BaseInstructionsParams} Base configuration for instructions
 * @param parameters - {@link BuildApproveParameters} The parameters for the trigger action
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * // Build a trigger instruction for an approval
 * const instructions = await buildApprove(
 *   { account: myMultichainAccount },
 *   {
 *     chainId: 1,
 *     address: myUSDC.addressOn(1),
 *     amount: 100n
 *   }
 * )
 */
export type BuildApproveParams = BaseInstructionsParams & {
  parameters: BuildApproveParameters
}

export const buildApprove = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildApproveParameters
): Promise<Instruction[]> => {
  const { account, currentInstructions = [] } = baseParams
  const { chainId, tokenAddress, amount, gasLimit, spender } = parameters
  const spender_ = spender ?? account.addressOn(chainId, true)

  const triggerCall: AbstractCall = {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender_, amount]
    }),
    ...(gasLimit ? { gasLimit } : {})
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
