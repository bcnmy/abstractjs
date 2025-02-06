import { type Address, encodeFunctionData } from "viem"
import type {
  AbstractCall,
  Instruction,
  Trigger
} from "../../../clients/decorators/mee"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import { addressEquals } from "../../utils"
import type { BaseInstructionsParams } from "../build"

/**
 * Parameters for building a transfer instruction
 */
export type BuildWithdrawalParameters = Trigger & {
  /**
   * Gas limit for the transfer transaction. Required when using the standard
   * transfer function instead of permit.
   * @example 65000n
   */
  gasLimit?: bigint
  /**
   * Recipient address. Defaults to the account's signer address.
   * @example "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
   */
  recipient?: Address
}

/**
 * Parameters for the buildWithdrawal function
 */
export type BuildWithdrawalParams = BaseInstructionsParams & {
  /**
   * Parameters specific to the transfer instruction
   * @see {@link BuildWithdrawalParameters}
   */
  parameters: BuildWithdrawalParameters
}

/**
 * Builds an instruction for transferring tokens. This function creates the necessary
 * instruction for a standard ERC20 transfer.
 *
 * @param baseParams - Base configuration for the instruction
 * @param baseParams.account - The account that will execute the transfer
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - Parameters for the transfer
 * @param parameters.chainId - Chain ID where the transfer will be executed
 * @param parameters.tokenAddress - Address of the token to transfer
 * @param parameters.amount - Amount to transfer
 * @param [parameters.gasLimit] - Optional gas limit for the transfer
 * @param [parameters.recipient] - Optional recipient address
 *
 * @returns Promise resolving to array of instructions
 *
 * @example
 * ```typescript
 * const instructions = await buildWithdrawal(
 *   { account: myMultichainAccount },
 *   {
 *     chainId: 1,
 *     tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     amount: 1000000n, // 1 USDC
 *     gasLimit: 65000n,
 *     recipient: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *   }
 * );
 * ```
 */
export const buildWithdrawal = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildWithdrawalParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [], account } = baseParams
  const {
    chainId,
    tokenAddress,
    amount,
    gasLimit,
    recipient = account.signer.address
  } = parameters

  const isNativeToken = addressEquals(
    tokenAddress,
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  )

  const erc20TokenCall: AbstractCall = {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: TokenWithPermitAbi,
      functionName: "transfer",
      args: [recipient, amount]
    }),
    ...(gasLimit ? { gasLimit } : {})
  }

  const nativeTokenCall: AbstractCall = {
    to: recipient,
    value: amount,
    ...(gasLimit ? { gasLimit } : {})
  }

  const triggerCall = isNativeToken ? nativeTokenCall : erc20TokenCall

  return [
    ...currentInstructions,
    {
      calls: [triggerCall],
      chainId
    }
  ]
}

export default buildWithdrawal
