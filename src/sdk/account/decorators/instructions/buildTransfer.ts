import { type Address, encodeFunctionData } from "viem"
import type { AbstractCall, Instruction } from "../../../clients/decorators/mee"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { AnyData } from "../../../modules/utils/Types"
import {
  type ComposableCall,
  isComposableCallRequired
} from "../../../modules/utils/composabilityCalls"
import {
  type RuntimeValue,
  getFunctionContextFromAbi
} from "../../../modules/utils/runtimeAbiEncoding"
import type { BaseInstructionsParams, TokenParams } from "../build"
import {
  type BuildComposableParameters,
  buildComposableCall
} from "./buildComposable"

/**
 * Parameters for building a transfer instruction
 */
export type BuildTransferParameters = TokenParams & {
  /**
   * Gas limit for the transfer transaction. Required when using the standard
   * transfer function instead of permit.
   * @example 65000n
   */
  gasLimit?: bigint
  /**
   * Recipient address.
   * @example "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
   */
  recipient: Address
}

/**
 * Parameters for the buildTransfer function
 */
export type BuildTransferParams = BaseInstructionsParams & {
  /**
   * Parameters specific to the transfer instruction
   * @see {@link BuildTransferParameters}
   */
  parameters: BuildTransferParameters
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
 * const instructions = await buildTransfer(
 *   { accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
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
export const buildTransfer = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildTransferParameters,
  forceComposableEncoding = false,
  efficientMode = true
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const { chainId, tokenAddress, amount, gasLimit, recipient } = parameters

  const abi = TokenWithPermitAbi
  const functionSig = "transfer"
  const args: readonly [`0x${string}`, bigint | RuntimeValue] = [
    recipient,
    amount
  ]

  const functionContext = getFunctionContextFromAbi(functionSig, abi)

  // Check for the runtime arguments and detect the need for composable call
  const isComposableCall = forceComposableEncoding
    ? true
    : isComposableCallRequired(
        functionContext,
        args as unknown as Array<AnyData>
      )

  let triggerCalls: AbstractCall[] | ComposableCall[]

  // If the composable call is detected ? The call needs to composed with runtime encoding
  if (isComposableCall) {
    const composableCallParams: BuildComposableParameters = {
      to: tokenAddress,
      functionName: functionSig,
      args: args as unknown as Array<AnyData>,
      abi,
      chainId,
      ...(gasLimit ? { gasLimit } : {})
    }

    triggerCalls = await buildComposableCall(
      baseParams,
      composableCallParams,
      efficientMode
    )
  } else {
    triggerCalls = [
      {
        to: tokenAddress,
        data: encodeFunctionData({
          abi,
          functionName: functionSig,
          args: args as [`0x${string}`, bigint]
        }),
        ...(gasLimit ? { gasLimit } : {})
      }
    ] as AbstractCall[]
  }

  return [
    ...currentInstructions,
    {
      calls: triggerCalls,
      chainId,
      isComposable: isComposableCall
    }
  ]
}

export default buildTransfer
