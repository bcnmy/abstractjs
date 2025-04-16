import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi
} from "viem"
import type { AnyData } from "../../modules/utils/Types"
import {
  type FunctionContext,
  type RuntimeValue,
  encodeRuntimeFunctionData
} from "./runtimeAbiEncoding"

export type InputParam = {
  fetcherType: InputParamFetcherType
  paramData: string
  constraints: Constraint[]
}

export type OutputParam = {
  fetcherType: OutputParamFetcherType
  paramData: string
}

export const InputParamFetcherType = {
  RAW_BYTES: 0,
  STATIC_CALL: 1
} as const

export const OutputParamFetcherType = {
  EXEC_RESULT: 0,
  STATIC_CALL: 1
} as const

export const ConstraintType = {
  EQ: 0,
  GTE: 1,
  LTE: 2,
  IN: 3
} as const

export type InputParamFetcherType =
  (typeof InputParamFetcherType)[keyof typeof InputParamFetcherType]
export type OutputParamFetcherType =
  (typeof OutputParamFetcherType)[keyof typeof OutputParamFetcherType]
export type ConstraintType =
  (typeof ConstraintType)[keyof typeof ConstraintType]

export type Constraint = {
  constraintType: ConstraintType
  referenceData: string
}

export type BaseComposableCall = {
  to: Address
  value: bigint
  functionSig: string
  inputParams: InputParam[]
  outputParams: OutputParam[]
}

export type ComposableCall = BaseComposableCall & {
  gasLimit?: bigint
}

export type ConstraintField = {
  type: ConstraintType
  value: AnyData // type any is being implicitly used. The appropriate value validation happens in the runtime function
}

export type RuntimeERC20BalanceOfParams = {
  targetAddress: Address
  tokenAddress: Address
  constraints?: ConstraintField[]
}

// Detects whether the value is runtime injected value or not
export const isRuntimeComposableValue = (value: AnyData) => {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.isRuntime
  ) {
    return true
  }

  return false
}

export const prepareInputParam = (
  fetcherType: InputParamFetcherType,
  paramData: string,
  constraints: Constraint[] = []
): InputParam => {
  return { fetcherType, paramData, constraints }
}

export const prepareOutputParam = (
  fetcherType: OutputParamFetcherType,
  paramData: string
): OutputParam => {
  return { fetcherType, paramData }
}

export const prepareConstraint = (
  constraintType: ConstraintType,
  referenceData: string
): Constraint => {
  return { constraintType, referenceData }
}

// type any is being implicitly used. The appropriate value validation happens in the runtime function
export const greaterThanOrEqualTo = (value: AnyData): ConstraintField => {
  return { type: ConstraintType.GTE, value }
}

// type any is being implicitly used. The appropriate value validation happens in the runtime function
export const lessThanOrEqualTo = (value: AnyData): ConstraintField => {
  return { type: ConstraintType.LTE, value }
}

// type any is being implicitly used. The appropriate value validation happens in the runtime function
export const equalTo = (value: AnyData): ConstraintField => {
  return { type: ConstraintType.EQ, value }
}

export const runtimeERC20BalanceOf = ({
  targetAddress,
  tokenAddress,
  constraints = []
}: RuntimeERC20BalanceOfParams): RuntimeValue => {
  const defaultFunctionSig = "balanceOf"

  const encodedParam = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [
      tokenAddress,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: defaultFunctionSig,
        args: [targetAddress]
      })
    ]
  )

  const constraintsToAdd: Constraint[] = []

  if (constraints.length > 0) {
    for (const constraint of constraints) {
      // Contraint type IN is ignored for the runtimeBalanceOf
      // This is mostly a number/unit/int, so it makes sense to only have EQ, GTE, LTE
      if (
        !Object.values(ConstraintType).slice(0, 3).includes(constraint.type)
      ) {
        throw new Error("Invalid contraint type")
      }

      // Handle value validation in a appropriate to runtime function
      if (
        typeof constraint.value !== "bigint" ||
        constraint.value < BigInt(0)
      ) {
        throw new Error("Invalid contraint value")
      }

      const valueHex = `0x${constraint.value.toString(16).padStart(64, "0")}`
      const encodedConstraintValue = encodeAbiParameters(
        [{ type: "bytes32" }],
        [valueHex as Hex]
      )

      constraintsToAdd.push(
        prepareConstraint(constraint.type, encodedConstraintValue)
      )
    }
  }

  return {
    isRuntime: true,
    inputParams: [
      prepareInputParam(
        InputParamFetcherType.STATIC_CALL,
        encodedParam,
        constraintsToAdd
      )
    ],
    outputParams: []
  }
}

/// @dev This is a helper function for composable pseudo-dynamic `bytes` values.
/// which are in fact several static values abi.encoded together
/// and we want one of those static values to be runtime value
/// so what we do here is we just treat runtimeAbiEncode as pseudo-function composable call
/// and just mimic the process of encoding the params for it.
/// it prepares the independent encoding with internal offsets for dynamic params, so
/// every `runtimeAbiEncode` can has nested `runtimeAbiEncode`-s inside it
export const runtimeAbiEncode = (
  /*
  functionContext: FunctionContext,
  args: Array<AnyData>
  */
): RuntimeValue => {

  // prepare functionContext and args out of what this helper is expecting  
  const inputParams: InputParam[] = prepareComposableParams(functionContext, args)

  // so in the upper level function call encoding, there will be a runtime dynamic `bytes` argument
  // with several input params here. some of those params will be runtime values (fetcherType: STATIC_CALL)
  // and some of them will be raw bytes (fetcherType: RAW_BYTES)
  // So we should account for that in the `encodeParams` method
  return {
    isRuntime: true,
    inputParams: inputParams,
    outputParams: []
  }
  
}

export const isComposableCallRequired = (
  functionContext: FunctionContext,
  args: Array<AnyData>
): boolean => {
  if (!functionContext.inputs || functionContext.inputs.length <= 0)
    return false

  const isComposableCall = functionContext.inputs.some((input, inputIndex) => {
    // Only struct and arrays has child elements and require iterating them internally.
    // String and bytes are also dynamic but they are mostly treated as one single value for detection
    if (input.type === "tuple") {
      // Struct arguments are handled here

      // Composable call detection
      const isComposableCallDetected = Object.values(args[inputIndex]).some(
        (internalArg: AnyData) => isRuntimeComposableValue(internalArg)
      )

      return isComposableCallDetected
    }

    if (input.type.match(/^(.*)\[(\d+)?\]$/)) {
      // matches against both static and dynamic arrays.
      // Array arguments are handled here

      // Composable call detection
      const isComposableCallDetected = args[inputIndex].some(
        (internalArg: AnyData) => isRuntimeComposableValue(internalArg)
      )

      return isComposableCallDetected
    }

    // Below mentioned common values are handled here.
    // intX, uintX, bytesX, bytes, string, bool, address are direct values and doesn't need iteration on child elements.

    // Composable call detection
    return isRuntimeComposableValue(args[inputIndex])
  })

  return isComposableCall
}

export const prepareComposableParams = (
  functionContext: FunctionContext,
  args: Array<AnyData>
) => {
  const composableParams = encodeRuntimeFunctionData(functionContext, args).map(
    (calldata) => {
      if (isRuntimeComposableValue(calldata)) {
        // Just handling input params here. In future, we may need to add support for output params as well
        return (calldata as RuntimeValue)?.inputParams
      }

      
      // TODO: What if calldata is RuntimeValue object with isRuntime = false?
      // We can not treat it as Hex , we should also extract the inputParams from it
      // ================================
      // In theory RuntimeValue should never have `isRuntime = false` 
      // but in theory it is possible. why do we even have this field? 
      // Can we just check that if the object type is RuntimeValue instead of checking isRuntime === true?
      
      
      // These are non runtime values which are encoded by the encodeRuntimeFunctionData helper.
      // These params are injected are individual raw bytes which will be combined on the composable contract
      return [
        prepareInputParam(InputParamFetcherType.RAW_BYTES, calldata as Hex)
      ]
    }
  )

  // Head Params,Head Params,Head Params + (len + Tail Params),(len + Tail Params),(len + Tail Params)
  // Static type doesn't have tail
  // Dynamic types have tail params where the head only have offset which points the dynamic param in tail
  return composableParams.flat()
}

export const prepareRawComposableParams = (calldata: Hex) => {
  const composableParams = [
    prepareInputParam(InputParamFetcherType.RAW_BYTES, calldata as Hex)
  ]

  // Head Params,Head Params,Head Params + (len + Tail Params),(len + Tail Params),(len + Tail Params)
  // Static type doesn't have tail
  // Dynamic types have tail params where the head only have offset which points the dynamic param in tail
  return composableParams.flat()
}
