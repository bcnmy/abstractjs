import {
  type Abi,
  type Address,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  isAddress
} from "viem"
import { isNativeToken } from "../../../account/utils"
import type { Instruction } from "../../../clients/decorators/mee"
import { ComposabilityVersion } from "../../../constants"
import type { AnyData } from "../../../modules/utils/Types"
import {
  type ComposableCall,
  type InputParam,
  InputParamFetcherType,
  InputParamType,
  prepareComposableInputCalldataParams,
  prepareInputParam
} from "../../../modules/utils/composabilityCalls"
import {
  type RuntimeValue,
  getFunctionContextFromAbi
} from "../../../modules/utils/runtimeAbiEncoding"
import { encodeAddress } from "../../../modules/utils/runtimeAbiEncoding"
import type { BaseInstructionsParams, ComposabilityParams } from "../build"

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
  to: Address | RuntimeValue
  functionName: string
  args: Array<AnyData> // This is being a generic function, if we add generic type, it is affecting previous parent function which can be handled later
  abi: Abi
  chainId: number
  gasLimit?: bigint
  value?: bigint | RuntimeValue
}

export type BuildNativeTokenTransferComposableParameters = {
  to: Address | RuntimeValue
  gasLimit?: bigint
  value: bigint | RuntimeValue
  chainId: number
}

export const buildComposableCall = async (
  parameters: BuildComposableParameters,
  composabilityParameters: ComposabilityParams
): Promise<ComposableCall[]> => {
  const { to, gasLimit, value, functionName, args, abi } = parameters
  const {
    efficientMode = true, // saving gas by default
    composabilityVersion
  } = composabilityParameters

  if (!composabilityVersion) {
    throw new Error(`Composability version is required to build a composable call. 
      This error may be caused by using a non-composable .build decorator with a composable call. 
      Please use buildComposable instead.`)
  }

  if (!functionName || !args) {
    throw new Error("Invalid params for composable call")
  }

  if (!abi) {
    throw new Error("Invalid ABI")
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

  const versionAgnosticComposableInputParams: InputParam[] =
    prepareComposableInputCalldataParams([...functionContext.inputs], args)

  const composableCall = formatComposableCallWithVersion(
    composabilityVersion,
    efficientMode,
    versionAgnosticComposableInputParams,
    functionContext.functionSig,
    to,
    value,
    gasLimit
  )

  return [composableCall]
}

/**
 * Formats the composable call version based on the composability version
 * @param composabilityVersion
 * @param efficientMode
 * @param versionAgnosticComposableInputParams
 * @param functionContext
 * @param to
 * @param value
 * @param gasLimit
 * @returns
 */
export const formatComposableCallWithVersion = (
  composabilityVersion: ComposabilityVersion,
  efficientMode: boolean,
  versionAgnosticComposableInputParams: InputParam[],
  functionSig: string,
  to: Address | RuntimeValue,
  value?: bigint | RuntimeValue,
  gasLimit?: bigint
): ComposableCall => {
  let composableCall: ComposableCall
  // Handle different composability versions
  if (composabilityVersion === ComposabilityVersion.V1_0_0) {
    if (!isAddress(to as Address)) {
      throw new Error("Invalid target contract address")
    }
    // format composable call for composability version 1.0.0 with to and value
    composableCall = {
      to: to as Address,
      value: (value as bigint) ?? BigInt(0),
      functionSig,
      inputParams: formatCallDataInputParamsWithVersion(
        composabilityVersion,
        efficientMode,
        versionAgnosticComposableInputParams
      ),
      outputParams: [], // In the current scope, output params are not handled. When more composability functions are added, this will change
      ...(gasLimit ? { gasLimit } : {})
    }
  } else {
    const callDataInputParams = formatCallDataInputParamsWithVersion(
      composabilityVersion,
      efficientMode,
      versionAgnosticComposableInputParams
    )

    const { targetInputParam, valueInputParam } =
      prepareTargetAndValueInputParams(to, value)

    const inputParams = [
      ...callDataInputParams,
      targetInputParam,
      ...(valueInputParam ? [valueInputParam] : []) // do not add valueInputParam if it is undefined
    ]

    // format composable call for composability version 1.1.0+ with target and value as input params
    composableCall = {
      functionSig,
      inputParams: inputParams,
      outputParams: [], // In the current scope, output params are not handled. When more composability functions are added, this will change
      ...(gasLimit ? { gasLimit } : {})
    }
  }
  return composableCall
}

/**
 * Formats the call data input params based on the composability version
 * @param composabilityVersion
 * @param efficientMode
 * @param versionAgnosticInputParams
 * @returns
 */
export const formatCallDataInputParamsWithVersion = (
  composabilityVersion: ComposabilityVersion,
  efficientMode: boolean,
  versionAgnosticInputParams: InputParam[]
): InputParam[] => {
  const compressedVersionAgnosticInputParams = efficientMode
    ? compressCalldataInputParams(versionAgnosticInputParams)
    : versionAgnosticInputParams
  if (composabilityVersion === ComposabilityVersion.V1_0_0) {
    // backwards compatibility for composability version 1.0.0
    // for composability version 1.0.0, we need to back convert
    // input params with fetcherType BALANCE to input params with fetcherType STATIC_CALL
    // since the BALANCE fetcher type is not supported in composability version 1.0.0
    return compressedVersionAgnosticInputParams.map((param) => {
      if (param.fetcherType === InputParamFetcherType.BALANCE) {
        // param data for Balance is abi.encodePacked([tokenAddress, targetAddress])
        // slice it accordingly to get the tokenAddress and targetAddress
        const tokenAddress =
          `0x${param.paramData.slice(2, 42)}` as `0x${string}`
        const targetAddress =
          `0x${param.paramData.slice(42, 82)}` as `0x${string}`

        if (isNativeToken(tokenAddress)) {
          throw new Error(
            "Native token balance as a runtime value is not supported for Composability v1.0.0"
          )
        }

        const encodedParam = encodeAbiParameters(
          [{ type: "address" }, { type: "bytes" }],
          [
            tokenAddress,
            encodeFunctionData({
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [targetAddress]
            })
          ]
        )
        return prepareInputParam(
          InputParamFetcherType.STATIC_CALL,
          encodedParam,
          param.constraints
        )
      }
      // for other input params, return them as is
      return param
    })
  }
  // for composability version 1.1.0+, we need to add paramType: CALL_DATA to the input params
  // since the input param type field is required for composability version 1.1.0+
  return compressedVersionAgnosticInputParams.map((param) => ({
    ...param,
    paramType: InputParamType.CALL_DATA
  }))
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
 * @param composabilityParams.composabilityVersion - Composability version to use
 * @param composabilityParams.efficientMode - boolean whether to compress the calldata input params or not
 * @param composabilityParams.forceComposableEncoding - boolean whether to force use composability or not
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
 *   },
 *   {
 *     composabilityVersion: ComposabilityVersion.V1_0_0
 *     efficientMode: true
 *     forceComposableEncoding: false
 *   }
 * )
 * ```
 */
export const buildComposableUtil = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildComposableParameters,
  composabilityParams: ComposabilityParams
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams

  const calls = await buildComposableCall(parameters, composabilityParams)

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
const compressCalldataInputParams = (
  inputParams: InputParam[]
): InputParam[] => {
  const compressedParams: InputParam[] = []
  let currentParam: InputParam = {
    fetcherType: InputParamFetcherType.RAW_BYTES,
    constraints: [],
    paramData: ""
  }
  // compress only calldata input params
  for (const param of inputParams) {
    if (
      param.paramType === InputParamType.TARGET ||
      param.paramType === InputParamType.VALUE
    ) {
      throw new Error("Target or value input params should not be compressed")
    }
    // Static call, balance or constraint based params are left as is
    if (
      param.fetcherType === InputParamFetcherType.STATIC_CALL ||
      param.fetcherType === InputParamFetcherType.BALANCE ||
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

const prepareTargetAndValueInputParams = (
  to: Address | RuntimeValue,
  value?: bigint | RuntimeValue
): {
  targetInputParam: InputParam
  valueInputParam: InputParam | undefined
} => {
  // Prepare target and value input params
  // if to is of type Address, then we need to prepare the target input param as raw_bytes
  // else if to is of type RuntimeValue, then we need to prepare the target input param
  let targetInputParam: InputParam
  if (isAddress(to as Address)) {
    targetInputParam = {
      paramType: InputParamType.TARGET,
      fetcherType: InputParamFetcherType.RAW_BYTES,
      paramData: encodeAddress(to as Address).data[0] as `0x${string}`,
      constraints: []
    }
  } else {
    targetInputParam = {
      ...(to as RuntimeValue).inputParams[0],
      paramType: InputParamType.TARGET
    }
  }

  let valueInputParam: InputParam | undefined
  if (!value) {
    // value not provided, default to 0
    valueInputParam = undefined
    // undefined valueInputParam would not be added to the composable call
    // and then the smart contract will use the default value of 0
    // thus saving gas on processing one input param
  } else if (
    (value as RuntimeValue).isRuntime &&
    (value as RuntimeValue).inputParams.length > 0
  ) {
    // value is a runtime value, use the first input param
    valueInputParam = {
      ...(value as RuntimeValue).inputParams[0],
      paramType: InputParamType.VALUE
    }
  } else {
    // value is a static value, use it as raw_bytes
    if (value !== 0n) {
      valueInputParam = {
        paramType: InputParamType.VALUE,
        fetcherType: InputParamFetcherType.RAW_BYTES,
        paramData: (value as bigint)
          .toString(16)
          .padStart(64, "0") as `0x${string}`,
        constraints: []
      }
    }
  }
  return { targetInputParam, valueInputParam }
}
