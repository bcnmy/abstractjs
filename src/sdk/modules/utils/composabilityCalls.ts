import {
  type AbiParameter,
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  isAddress,
  isHex,
  parseAbi,
  zeroAddress
} from "viem"
import type { Abi } from "viem"
import { toBytes32 } from "../../account"
import { ENTRY_POINT_ADDRESS } from "../../constants"
import type { AnyData } from "../../modules/utils/Types"
import {
  type FunctionContext,
  type RuntimeValue,
  encodeRuntimeFunctionData
} from "./runtimeAbiEncoding"

/**
 * fetcherType: Defines how to fetch the param
 * paramData: The data that is used during fetching the param
 * constraints: The constraints that the resulting param needs to satisfy
 * paramType: The type of the param. This field is optional and it is introduced in the composability version 1.1.0
 * If earlier versions are used, this field may not not present.
 */
export type InputParam = {
  paramType?: InputParamType
  fetcherType: InputParamFetcherType
  paramData: string
  constraints: Constraint[]
}

export type OutputParam = {
  fetcherType: OutputParamFetcherType
  paramData: string
}

/**
 * paramType: The type of the param.
 * TARGET: The target address => used as a target address for the call
 * VALUE: The value => used as a native value for the call
 * CALL_DATA: processed param will be part of the calldata for the call
 * This field is optional and it is introduced in the composability version 1.1.0
 * If earlier versions are used, this field may not not present.
 */
export const InputParamType = {
  TARGET: 0,
  VALUE: 1,
  CALL_DATA: 2
} as const

/**
 * fetcherType: Defines how to fetch the param
 * RAW_BYTES: just use param data as is (raw bytes)
 * STATIC_CALL: param data defines the params for the static call
 * Outputs of the static call will form the processed param
 * BALANCE: param data defines the params for the balance query
 */
export const InputParamFetcherType = {
  RAW_BYTES: 0,
  STATIC_CALL: 1,
  BALANCE: 2
} as const

export const OutputParamFetcherType = {
  EXEC_RESULT: 0,
  STATIC_CALL: 1
} as const

export const ConstraintType = {
  EQ: 0,
  GTE: 1,
  LTE: 2,
  IN: 3,
  GTE_SIGNED: 4,
  LTE_SIGNED: 5,
  OR: 6
} as const

export type InputParamFetcherType =
  (typeof InputParamFetcherType)[keyof typeof InputParamFetcherType]
export type OutputParamFetcherType =
  (typeof OutputParamFetcherType)[keyof typeof OutputParamFetcherType]
export type ConstraintType =
  (typeof ConstraintType)[keyof typeof ConstraintType]
export type InputParamType =
  (typeof InputParamType)[keyof typeof InputParamType]

export type Constraint = {
  constraintType: ConstraintType
  referenceData: string
}

/**
 * Base composable call type
 * @param functionSig - The function signature of the composable call
 * @param inputParams - The input parameters of the composable call
 * @param outputParams - The output parameters of the composable call
 * @param to - The address of the target contract.
 * @param value - The value of the composable call.
 * Since Composability version 1.1.0, to and value are not required
 * as they are replaced by the input params with according types (TARGET, VALUE)
 */
export type BaseComposableCall = {
  to?: Address
  value?: bigint
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

type ConstraintValue = bigint | boolean | Hex | Address

export type ChildConstraint =
  | { gte: ConstraintValue }
  | { lte: ConstraintValue }
  | { eq: ConstraintValue }
  | { gteSigned: bigint }
  | { lteSigned: bigint }

export type RuntimeConstraint = ChildConstraint | { or: ChildConstraint[] }

export const CONSTRAINT_TUPLE_ABI = {
  type: "tuple[]",
  components: [
    { name: "constraintType", type: "uint8" },
    { name: "referenceData", type: "bytes" }
  ]
} as const

export type RuntimeParamViaCustomStaticCallParams = {
  targetContractAddress: Address
  functionAbi: Abi
  args: Array<AnyData>
  functionName?: string
  constraints?: ConstraintField[]
}

export type runtimeERC20AllowanceOfParams = {
  owner: Address
  spender: Address
  tokenAddress: Address
  constraints?: ConstraintField[]
}

export type RuntimeBalanceOfParams = {
  targetAddress: Address
  tokenAddress: Address
  constraints?: ConstraintField[]
}

export type RuntimeNativeBalanceOfParams = Omit<
  RuntimeBalanceOfParams,
  "tokenAddress"
>

export type RuntimeNonceOfParams = {
  smartAccountAddress: Address
  nonceKey: bigint
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

export const greaterThanOrEqualToSigned = (value: AnyData): ConstraintField => {
  return { type: ConstraintType.GTE_SIGNED, value }
}

export const lessThanOrEqualToSigned = (value: AnyData): ConstraintField => {
  return { type: ConstraintType.LTE_SIGNED, value }
}

export const orConstraint = (
  subConstraints: ConstraintField[]
): ConstraintField => {
  return { type: ConstraintType.OR, value: subConstraints }
}

const CHILD_CONSTRAINT_TYPES = new Set<ConstraintType>([
  ConstraintType.EQ,
  ConstraintType.GTE,
  ConstraintType.LTE,
  ConstraintType.GTE_SIGNED,
  ConstraintType.LTE_SIGNED
])

const SIGNED_CONSTRAINT_TYPES = new Set<ConstraintType>([
  ConstraintType.GTE_SIGNED,
  ConstraintType.LTE_SIGNED
])

const validateAndProcessChildConstraint = (
  constraint: ConstraintField
): Constraint => {
  if (constraint.type === ConstraintType.OR)
    throw new Error("Nested OR constraints are not supported")

  if (!CHILD_CONSTRAINT_TYPES.has(constraint.type))
    throw new Error("Invalid constraint type")

  if (SIGNED_CONSTRAINT_TYPES.has(constraint.type)) {
    if (typeof constraint.value !== "bigint")
      throw new Error(
        "Invalid constraint value: signed constraints require bigint"
      )

    // Encode as int256 to preserve two's-complement, then wrap in bytes32
    // The contract casts bytes32 → uint256 → int256 on both sides before comparing
    const valueHex = encodeAbiParameters(
      [{ type: "int256" }],
      [constraint.value]
    )
    const referenceData = encodeAbiParameters(
      [{ type: "bytes32" }],
      [valueHex as Hex]
    )
    return { constraintType: constraint.type, referenceData }
  }

  // Unsigned path (EQ, GTE, LTE) — existing logic unchanged
  if (
    typeof constraint.value !== "bigint" &&
    typeof constraint.value !== "boolean" &&
    !isHex(constraint.value) &&
    !isAddress(constraint.value)
  ) {
    throw new Error("Invalid constraint value")
  }

  if (typeof constraint.value === "bigint" && constraint.value < BigInt(0)) {
    throw new Error("Invalid constraint value")
  }

  const valueHex = toBytes32(constraint.value)
  const referenceData = encodeAbiParameters(
    [{ type: "bytes32" }],
    [valueHex as Hex]
  )
  return prepareConstraint(constraint.type, referenceData)
}

/**
 * Validates and processes constraints for runtime functions
 * @param constraints - Array of constraint fields to validate and process
 * @returns Array of processed constraints ready for use
 */
export const validateAndProcessConstraints = (
  constraints: ConstraintField[]
): Constraint[] => {
  const result: Constraint[] = []

  for (const constraint of constraints) {
    if (constraint.type === ConstraintType.OR) {
      if (!Array.isArray(constraint.value) || constraint.value.length === 0)
        throw new Error("OR constraint must have at least one sub-constraint")

      const processedSubs = (constraint.value as ConstraintField[]).map(
        validateAndProcessChildConstraint
      )

      // Encode as abi.encode(Constraint[]) — matches what the contract decodes:
      // Constraint[] memory subs = abi.decode(c.referenceData, (Constraint[]));
      const referenceData = encodeAbiParameters(
        [CONSTRAINT_TUPLE_ABI],
        [
          processedSubs.map((c) => ({
            constraintType: c.constraintType,
            referenceData: c.referenceData as Hex
          }))
        ]
      )

      result.push({ constraintType: ConstraintType.OR, referenceData })
    } else {
      result.push(validateAndProcessChildConstraint(constraint))
    }
  }

  return result
}

export const runtimeNonceOf = ({
  smartAccountAddress,
  nonceKey,
  constraints = []
}: RuntimeNonceOfParams): RuntimeValue => {
  const defaultFunctionSig = "getNonce"

  const entryPointNonceAbi = parseAbi([
    "function getNonce(address sender, uint192 key) public view returns (uint256)"
  ])

  const encodedParam = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [
      ENTRY_POINT_ADDRESS,
      encodeFunctionData({
        abi: entryPointNonceAbi,
        functionName: defaultFunctionSig,
        args: [smartAccountAddress, nonceKey]
      })
    ]
  )

  const constraintsToAdd = validateAndProcessConstraints(constraints)

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

export const runtimeParamViaCustomStaticCall = ({
  targetContractAddress,
  functionAbi,
  functionName,
  args,
  constraints = []
}: RuntimeParamViaCustomStaticCallParams): RuntimeValue => {
  const encodedParam = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [
      targetContractAddress,
      encodeFunctionData({
        abi: functionAbi,
        functionName: functionName,
        args
      })
    ]
  )

  const constraintsToAdd = validateAndProcessConstraints(constraints)

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

/**
 * Returns the runtime value for the ERC20 allowance of the owner for the spender
 * @param owner - The owner of the tokens
 * @param spender - The spender of the tokens
 * @param tokenAddress - The address of the ERC20 token
 * @returns The runtime value for the ERC20 allowance of the owner for the spender
 */
export const runtimeERC20AllowanceOf = ({
  owner,
  spender,
  tokenAddress,
  constraints = []
}: runtimeERC20AllowanceOfParams): RuntimeValue => {
  const encodedParam = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes" }],
    [
      tokenAddress,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender]
      })
    ]
  )

  const constraintsToAdd = validateAndProcessConstraints(constraints)

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

/**
 * Returns the runtime value for the native balance of the target address
 * Utilizes the BALANCE fetcherType
 * @param targetAddress - The address of the target account
 * @returns The runtime value for the native balance of the target address
 */
export const runtimeNativeBalanceOf = ({
  targetAddress,
  constraints = []
}: RuntimeNativeBalanceOfParams): RuntimeValue => {
  return getBalanceOf({
    targetAddress,
    tokenAddress: zeroAddress,
    constraints
  })
}

/**
 * Returns the runtime value for the ERC20 balance of the target address
 * @param targetAddress - The address of the target account
 * @param tokenAddress - The address of the ERC20 token
 * @returns The runtime value for the ERC20 balance of the target address
 */
export const runtimeERC20BalanceOf = ({
  targetAddress,
  tokenAddress,
  constraints = []
}: RuntimeBalanceOfParams): RuntimeValue => {
  return getBalanceOf({
    targetAddress,
    tokenAddress,
    constraints
  })
}

const getBalanceOf = ({
  targetAddress,
  tokenAddress,
  constraints = []
}: RuntimeBalanceOfParams): RuntimeValue => {
  const constraintsToAdd = validateAndProcessConstraints(constraints)

  const encodedInputParamData = encodePacked(
    ["address", "address"],
    [tokenAddress, targetAddress]
  )

  return {
    isRuntime: true,
    inputParams: [
      prepareInputParam(
        InputParamFetcherType.BALANCE,
        encodedInputParamData,
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
export const runtimeEncodeAbiParameters = (
  // mimics the interface of the og encodeAbiParameters
  // but is able to work with runtime values
  inputs: AbiParameter[],
  args: Array<AnyData>
): RuntimeValue => {
  // prepare functionContext and args out of what this helper is expecting
  const inputParams: InputParam[] = prepareComposableInputCalldataParams(
    inputs,
    args
  )

  // so in the upper level function call encoding, there will be a runtime dynamic `bytes` argument
  // wrapped into a RuntimeValue object with several InputParam's.
  // Some of those params will be runtime values (fetcherType: STATIC_CALL)
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

export const prepareComposableInputCalldataParams = (
  inputs: AbiParameter[],
  args: Array<AnyData>
) => {
  const composableParams = encodeRuntimeFunctionData(inputs, args).map(
    (calldata) => {
      if (isRuntimeComposableValue(calldata)) {
        // Just handling input params here. In future, we may need to add support for output params as well
        return (calldata as RuntimeValue)?.inputParams
      }

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
