import { type Address, encodeFunctionData } from "viem"
import type {
  AbstractCall,
  Instruction,
  Trigger
} from "../../../clients/decorators/mee"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { BaseInstructionsParams } from "../build"

export type BuildTransferFromParameters = Trigger & {
  /**
   * Permit mode will use the transferFrom function, which requires a gas limit
   */
  gasLimit?: bigint
  /**
   * The owner of the token
   */
  owner?: Address
  /**
   * The grantee of the token
   */
  recipient?: Address
}

/**
 * Builds a trigger instruction for a transfer
 * @param baseParams - {@link BaseInstructionsParams} Base configuration for instructions
 * @param parameters - {@link BuildTransferFromParameters} The parameters for the trigger action
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * // Build a trigger instruction for a transfer
 * const instructions = await buildTransferFrom(
 *   { account: myMultichainAccount },
 *   {
 *     chainId: 1,
 *     address: myUSDC.addressOn(1),
 *     amount: 100n
 *   }
 * )
 */
export type BuildTransferFromParams = BaseInstructionsParams & {
  parameters: BuildTransferFromParameters
}

export const buildTransferFrom = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildTransferFromParameters
): Promise<Instruction[]> => {
  const { account, currentInstructions = [] } = baseParams
  const { chainId, tokenAddress, amount, gasLimit, owner, recipient } =
    parameters

  const owner_ = owner ?? account.signer.address
  const recipient_ = recipient ?? account.addressOn(chainId, true)

  const triggerCall: AbstractCall = {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: TokenWithPermitAbi,
      functionName: "transferFrom",
      args: [owner_, recipient_, amount]
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

export default buildTransferFrom
