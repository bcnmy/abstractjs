import { type Address, encodeFunctionData } from "viem"
import type { AbstractCall, Instruction } from "../../../clients/decorators/mee"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { AnyData } from "../../../modules/utils/Types"
import {
  type ComposableCall,
  InputParamFetcherType,
  isComposableCallRequired,
  isRuntimeComposableValue
} from "../../../modules/utils/composabilityCalls"
import {
  type RuntimeValue,
  getFunctionContextFromAbi
} from "../../../modules/utils/runtimeAbiEncoding"
import { addressEquals } from "../../utils"
import type { BaseInstructionsParams, ComposabilityParams, TokenParams } from "../build"
import {
  type BuildComposableParameters,
  buildComposableCall,
  buildValueTransferComposableCall
} from "./buildComposable"
import { ComposabilityVersion } from "../../../constants"

/**
 * Parameters for building a transfer instruction
 */
export type BuildWithdrawalParameters = TokenParams & {
  /**
   * Gas limit for the transfer transaction. Required when using the standard
   * transfer function instead of permit.
   * @example 65000n
   */
  gasLimit?: bigint
  /**
   * Recipient address. Defaults to the account's signer address.
   * Is not injectable in case of withdrawals.
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
export const buildWithdrawal = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildWithdrawalParameters,
  composabilityParams: ComposabilityParams
): Promise<Instruction[]> => {
  const { currentInstructions = [], accountAddress } = baseParams
  const {
    chainId,
    tokenAddress,
    amount,
    gasLimit,
    recipient = accountAddress // EOA or owner account address
  } = parameters
  const { forceComposableEncoding = false, composabilityVersion } = composabilityParams

  const isNativeToken = addressEquals(
    tokenAddress as Address,
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  ) || addressEquals(
    tokenAddress as Address,
    "0x0000000000000000000000000000000000000000"
  )

  let withdrawalCall: AbstractCall[] | ComposableCall[]

  if (isNativeToken) {
    if (isRuntimeComposableValue(amount)) {
      if (composabilityVersion === ComposabilityVersion.V1_0_0) {
        throw new Error("Runtime balance for Native tokens is not supported for Composability v1.0.0")
      }
      withdrawalCall = await buildValueTransferComposableCall(
        {
          to: recipient,
          value: amount,
          chainId,
          ...(gasLimit ? { gasLimit } : {})
        }
      )
    } else {
      // not composable call
      withdrawalCall = [
        {
          to: recipient as Address,
          value: amount as bigint,
          ...(gasLimit ? { gasLimit } : {})
        } as AbstractCall
      ] 
    }
  } else {
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

      withdrawalCall = await buildComposableCall(
        composableCallParams,
        composabilityParams
      )

      return [
        ...currentInstructions,
        {
          calls: withdrawalCall,
          chainId,
          isComposable: true
        }
      ]
    }
    withdrawalCall = [
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
      calls: withdrawalCall,
      chainId
    }
  ]
}

export default buildWithdrawal
