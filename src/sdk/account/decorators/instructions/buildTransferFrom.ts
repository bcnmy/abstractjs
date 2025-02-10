import { type Address, encodeFunctionData, erc20Abi } from "viem"
import type {
  AbstractCall,
  Instruction,
  Trigger
} from "../../../clients/decorators/mee"
import type { BaseInstructionsParams } from "../build"

/**
 * Parameters for building a transferFrom instruction
 */
export type BuildTransferFromParameters = Trigger & {
  /**
   * Gas limit for the transferFrom transaction. Required when using the standard
   * transferFrom function instead of permit.
   * @example 75000n
   */
  gasLimit?: bigint
  /**
   * Owner address.
   * @example "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
   */
  sender: Address
  /**
   * Recipient address.
   * @example "0x1234567890123456789012345678901234567890"
   */
  recipient: Address
}

/**
 * Parameters for the buildTransferFrom function
 */
export type BuildTransferFromParams = BaseInstructionsParams & {
  /**
   * Parameters specific to the transferFrom instruction
   * @see {@link BuildTransferFromParameters}
   */
  parameters: BuildTransferFromParameters
}

/**
 * Builds an instruction for transferring tokens using transferFrom. This function is used
 * when transferring tokens from an address that has approved the spender.
 *
 * @param baseParams - Base configuration for the instruction
 * @param baseParams.account - The account that will execute the transfer
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - Parameters for the transferFrom
 * @param parameters.chainId - Chain ID where the transfer will be executed
 * @param parameters.tokenAddress - Address of the token to transfer
 * @param parameters.amount - Amount to transfer
 * @param [parameters.gasLimit] - Optional gas limit for the transfer
 * @param [parameters.owner] - Optional owner address (defaults to signer)
 * @param [parameters.recipient] - Optional recipient address
 *
 * @returns Promise resolving to array of instructions
 *
 * @example
 * ```typescript
 * const instructions = await buildTransferFrom(
 *   { account: myMultichainAccount },
 *   {
 *     chainId: 1,
 *     tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     amount: 1000000n, // 1 USDC
 *     gasLimit: 75000n,
 *     owner: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *     recipient: "0x1234567890123456789012345678901234567890"
 *   }
 * );
 * ```
 */
export const buildTransferFrom = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildTransferFromParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const { chainId, tokenAddress, amount, gasLimit, sender, recipient } =
    parameters

  const triggerCall: AbstractCall = {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transferFrom",
      args: [sender, recipient, amount]
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
