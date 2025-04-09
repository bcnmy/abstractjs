import { type Abi, type Address, isAddress } from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import type { AnyData } from "../../../modules/utils/Types"
import {
  type ComposableCall,
  type InputParam,
  prepareComposableParams
} from "../../../modules/utils/composabilityCalls"
import { getFunctionContextFromAbi } from "../../../modules/utils/runtimeAbiEncoding"
import type { BaseInstructionsParams } from "../build"

// type OverrideObjectValues<T, OverrideType> = {
//   [K in keyof T]: T[K] | OverrideType; // Union of original ABI inferred type and runtime value type
// };

// type OverrideArrayObjects<T, OverrideType> = {
//   [K in keyof T]: OverrideObjectValues<T[K], OverrideType>;
// };

// TODO:
// These types are being removed for now as it requires all the previous parent function types needs to be changed.
// We will revisit on this topic later and this decision is taken based on the conversation with Joe.
// Function type:
// <
//   TAbi extends Abi,
//   TFunctionName extends ContractFunctionName<TAbi, "payable" | "nonpayable">
// >
// Args type:
// OverrideArrayObjects<
//   ContractFunctionArgs<TAbi, "payable" | "nonpayable", TFunctionName>,
//   RuntimeValue
// >;

/**
 * Parameters for building a composable instruction
 */
export type BuildComposableParameters = {
  to: Address
  functionName: string
  args: Array<AnyData> // This is being a generic function, if we add generic type, it is affecting previous parent function whihc can be handled later
  abi: Abi
  chainId: number
  gasLimit?: bigint
  value?: bigint
}

export const buildComposableCall = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildComposableParameters
): Promise<ComposableCall[]> => {
  const { account } = baseParams
  const { to, gasLimit, value, functionName, args, abi, chainId } = parameters

  if (!functionName || !args) {
    throw new Error("Invalid params for composable call")
  }

  if (!abi) {
    throw new Error("Invalid ABI")
  }

  if (!isAddress(to)) {
    throw new Error("Invalid target contract address")
  }

  const smartAccountAddress = account.addressOn(chainId, true)

  if (!isAddress(smartAccountAddress)) {
    throw new Error("Invalid smart account address")
  }

  if (args.length <= 0) {
    throw new Error(
      "Composable call is not required for a instruction which has zero args"
    )
  }

  const functionContext = getFunctionContextFromAbi(functionName, abi)

  if (functionContext?.inputs?.length !== args?.length) {
    throw new Error(`Invalid arguments for the ${functionName} function`)
  }

  const composableParams: InputParam[] = prepareComposableParams(
    functionContext,
    args
  )

  const composableCalls: ComposableCall[] = []

  const composableCall: ComposableCall = {
    to,
    value: value ?? BigInt(0),
    functionSig: functionContext.functionSig,
    inputParams: composableParams,
    outputParams: [], // In the current scope, output params are not handled. When more composability functions are added, this will change
    ...(gasLimit ? { gasLimit } : {})
  }

  composableCalls.push(composableCall)

  return composableCalls
}

/**
 * Builds an instruction for composable transaction. This is a generic function which creates the composable instructions
 * to execute against composability stack
 *
 * @param baseParams - Base configuration for the instruction
 * @param baseParams.account - The account that will execute the composable transaction
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - Parameters for generate composable instruction
 * @param parameters.to - Address of the target contract address
 * @param parameters.functionName - Function signature of the composable transaction call
 * @param parameters.args - Function arguments of the composable transaction call
 * @param parameters.abi - ABI of the contract where the composable transaction call is being generated from
 * @param parameters.chainId - Chain where the composable transaction will be executed
 * @param [parameters.gasLimit] - Optional gas limit
 * @param [parameters.value] - Optional native token value
 *
 * @returns Promise resolving to array of instructions
 *
 * @example
 * ```typescript
 * const instructions = buildComposable(
 *   { account: myMultichainAccount },
 *   {
 *     to: targetContractAddress,
 *     functionName: 'exactInputSingle',
 *     args: [
 *        {
 *          tokenIn: inToken.addressOn(baseSepolia.id),
 *          tokenOut: outToken.addressOn(baseSepolia.id),
 *          fee: 3000,
 *          recipient: recipient,
 *          deadline: BigInt(Math.floor(Date.now() / 1000) + 900),
 *          amountIn: runtimeERC20BalanceOf({ targetAddress: recipient, tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id), constraints: [] }),
 *          amountOutMinimum: BigInt(1),
 *          sqrtPriceLimitX96: BigInt(0),
 *        },
 *     ]
 *     chainId: baseSepolia.id,
 *     abi: UniswapSwapRouterAbi
 *   }
 * )
 * ```
 */
export const buildComposableUtil = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildComposableParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams

  const calls = await buildComposableCall(baseParams, parameters)

  return [
    ...currentInstructions,
    {
      calls: calls,
      chainId: parameters.chainId,
      isComposable: true
    }
  ]
}

export default buildComposableUtil
