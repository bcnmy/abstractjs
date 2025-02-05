import { type Address, encodeFunctionData } from "viem"
import type {
  AbstractCall,
  Instruction,
  Trigger
} from "../../../clients/decorators/mee"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { BaseInstructionsParams } from "../build"

export type BuildTransferParameters = Trigger & {
  /**
   * Permit mode will use the transfer function, which requires a gas limit
   */
  gasLimit?: bigint
  /**
   * The recipient of the token
   */
  recipient?: Address
}

/**
 * Builds a trigger instruction for a transfer
 * @param baseParams - {@link BaseInstructionsParams} Base configuration for instructions
 * @param parameters - {@link BuildTransferParameters} The parameters for the trigger action
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * // Build a trigger instruction for a transfer
 * const instructions = await buildTransfer(
 *   { account: myMultichainAccount },
 *   {
 *     chainId: 1,
 *     address: myUSDC.addressOn(1),
 *     amount: 100n
 *   }
 * )
 */
export type BuildTransferParams = BaseInstructionsParams & {
  parameters: BuildTransferParameters
}

export const buildTransfer = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildTransferParameters
): Promise<Instruction[]> => {
  const { account, currentInstructions = [] } = baseParams
  const { chainId, tokenAddress, amount, gasLimit, recipient } = parameters

  const recipient_ = recipient ?? account.addressOn(chainId, true)

  const triggerCall: AbstractCall = {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: TokenWithPermitAbi,
      functionName: "transfer",
      args: [recipient_, amount]
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

export default buildTransfer
