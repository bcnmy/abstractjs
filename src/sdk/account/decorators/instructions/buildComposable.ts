import { type Abi, type Address, concatHex, isAddress } from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import type { AnyData } from "../../../modules/utils/Types"
import {
  type ComposableCall,
  type InputParam,
  InputParamFetcherType,
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
  args: Array<AnyData> // This is being a generic function, if we add generic type, it is affecting previous parent function which can be handled later
  abi: Abi
  chainId: number
  gasLimit?: bigint
  value?: bigint
}

export const buildComposableCall = async (
  _baseParams: BaseInstructionsParams,
  parameters: BuildComposableParameters,
  efficientMode: boolean
): Promise<ComposableCall[]> => {
  const { to, gasLimit, value, functionName, args, abi } = parameters

  if (!functionName || !args) {
    throw new Error("Invalid params for composable call")
  }

  if (!abi) {
    throw new Error("Invalid ABI")
  }

  if (!isAddress(to)) {
    throw new Error("Invalid target contract address")
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
    [...functionContext.inputs],
    args
  )

  const composableCalls: ComposableCall[] = []

  const composableCall: ComposableCall = {
    to: to,
    value: value ?? BigInt(0),
    functionSig: functionContext.functionSig,
    inputParams: efficientMode
      ? compressInputParams(composableParams)
      : composableParams,
    //inputParams: composableParams,
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
 *   { accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
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
 *          amountIn: runtimeERC20BalanceOf({ targetAddress: recipient, tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id), constraints: [] }),
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
  parameters: BuildComposableParameters,
  efficientMode = true
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams

  const calls = await buildComposableCall(baseParams, parameters, efficientMode)

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

/**
 * Compresses the input params by merging the input params with InputParamFetcherType.RAW_BYTES
 * and no constraints together
 * It does this by creating a new InputParam with InputParamFetcherType.RAW_BYTES and no constraints
 * and paramData as the concat of paramData's
 * It allows for less input params in the composable call => less iterations in the composable smart contract
 * => less gas used
 */
const compressInputParams = (inputParams: InputParam[]): InputParam[] => {
  const compressedParams: InputParam[] = []
  let currentParam: InputParam = {
    fetcherType: InputParamFetcherType.RAW_BYTES,
    constraints: [],
    paramData: ""
  }

  for (const param of inputParams) {
    // Static call or constraint based params are left as is
    if (
      param.fetcherType === InputParamFetcherType.STATIC_CALL ||
      param.constraints.length > 0
    ) {
      // If there is a current param, push it to the compressed params
      // and reset the current param
      if (currentParam.paramData.length > 0) {
        compressedParams.push(currentParam)
        currentParam = {
          fetcherType: InputParamFetcherType.RAW_BYTES,
          constraints: [],
          paramData: ""
        }
      }
      compressedParams.push(param)
      continue
    }

    // If the current param is a raw bytes param with no constraints, merge it with the current param
    currentParam.paramData = concatHex([
      currentParam.paramData as `0x${string}`,
      param.paramData as `0x${string}`
    ])
  }

  // If there is a non-empty current param, push it to the compressed params
  if (currentParam.paramData.length > 0) {
    compressedParams.push(currentParam)
  }

  return compressedParams
}
