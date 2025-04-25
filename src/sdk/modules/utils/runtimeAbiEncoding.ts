// If anyone wanted to get comfortable with ABI encoding specification
// Check this out: https://docs.soliditylang.org/en/develop/abi-spec.html
// If you are a video person ?
// Check this out: https://www.youtube.com/watch?v=upVloLUw5Z0

// Author Information:
// This code is created and audited by Venkatesh Rajendran
// Github: https://github.com/vr16x
// Reachout to me if there is any issues or doubts
// X: https://x.com/vr16x
// Slack: https://biconomyworkspace.slack.com/team/U08HJN728RM

import {
  type Abi,
  AbiEncodingArrayLengthMismatchError,
  AbiEncodingBytesSizeMismatchError,
  AbiEncodingLengthMismatchError,
  type AbiFunction,
  type AbiParameter,
  type AbiParameterToPrimitiveType,
  BaseError,
  type Hex,
  IntegerOutOfRangeError,
  InvalidAbiEncodingTypeError,
  InvalidAddressError,
  InvalidArrayError,
  boolToHex,
  concat,
  isAddress,
  numberToHex,
  padHex,
  size,
  slice,
  stringToHex,
  toFunctionSelector
} from "viem"
import type { AnyData } from "../../modules/utils/Types"
import {
  type InputParam,
  InputParamFetcherType,
  type OutputParam,
  isRuntimeComposableValue
} from "./composabilityCalls"

export type FunctionContext = {
  inputs: readonly AbiParameter[]
  outputs: readonly AbiParameter[]
  name: string
  functionType: "read" | "write"
  functionSig: string
}

export type RuntimeValue = {
  isRuntime: boolean
  // hasNested: boolean
  inputParams: InputParam[]
  outputParams: OutputParam[]
}

type PreparedParam = { dynamic: boolean; data: (Hex | RuntimeValue)[] }
type TupleAbiParameter = AbiParameter & { components: readonly AbiParameter[] }
type Tuple = AbiParameterToPrimitiveType<TupleAbiParameter>

// Total list of int and uint types used for regex matching against the data type
const integerRegex =
  /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/

// length in hex (0x....5) + Right padded string hex (0x4j34ng2....0000)
// Example: 0x00000.....50x4j34ng2....0000
const encodeString = (value: string): PreparedParam => {
  const hexValue = stringToHex(value)
  const partsLength = Math.ceil(size(hexValue) / 32)
  const parts: Hex[] = []
  for (let i = 0; i < partsLength; i++) {
    parts.push(
      padHex(slice(hexValue, i * 32, (i + 1) * 32), {
        dir: "right"
      })
    )
  }

  return {
    dynamic: true,
    data: [
      concat([padHex(numberToHex(size(hexValue), { size: 32 })), ...parts]) // Concat string len + right padded string hex value
    ]
  }
}

// The encoding for bytes also treated same as string if it is a bytes value
// Example: 0x00000.....50x4j34ng2....0000
// Encoding for static bytes type is straight forward. It will be simply converted into hex with padding on right
// No length is used for static bytes type
// 0x50x4j34ng2....00000000
const encodeBytes = <const param extends AbiParameter>(
  value: AnyData,
  { param }: { param: param }
): PreparedParam => {
  const [, paramSize] = param.type.split("bytes")

  // Checks if the value is runtime value which means the appropriate encoding already happened in composability integration
  // In this case, we just need to determine whether the bytes is a static or dynamic value
  if (isRuntimeComposableValue(value)) {
    if (paramSize) {
      return { dynamic: false, data: [value] }
    }
    // if there is no param size, it is a dynamic value
    // calculate the length of the InputParams and push it as the first InputParam
    const inputParamsLength = getRuntimeValueLength(
      (value as RuntimeValue).inputParams
    )
    const firstInputParam: InputParam = {
      fetcherType: InputParamFetcherType.RAW_BYTES,
      paramData: numberToHex(inputParamsLength, { size: 32 }),
      constraints: []
    }
    value.inputParams = [firstInputParam, ...value.inputParams]
    return { dynamic: true, data: [value] }
  }

  const bytesSize = size(value)

  // If there is no param size, it is bytes data type and treated as dynamic value
  if (!paramSize) {
    let value_ = value
    // If the size is not divisible by 32 bytes, pad the end
    // with empty bytes to the ceiling 32 bytes.
    if (bytesSize % 32 !== 0)
      value_ = padHex(value_, {
        dir: "right",
        size: Math.ceil((value.length - 2) / 2 / 32) * 32
      })
    return {
      dynamic: true,
      data: [padHex(numberToHex(bytesSize, { size: 32 })), value_] // Length + Value
    }
  }

  // Check for param size which is extracted from type with actual byte size
  if (bytesSize !== Number.parseInt(paramSize))
    throw new AbiEncodingBytesSizeMismatchError({
      expectedSize: Number.parseInt(paramSize),
      value: value
    })

  return { dynamic: false, data: [padHex(value, { dir: "right" })] } // No length because of the static nature
}

// Number value is converted into 32 bytes hex
// Example: 0x000...0000002
const encodeNumber = (
  value: number,
  { signed, size = 256 }: { signed: boolean; size?: number | undefined }
): PreparedParam => {
  // Validating the boundary of uint and int types
  if (typeof size === "number") {
    const max =
      BigInt(2) ** (BigInt(size) - (signed ? BigInt(1) : BigInt(0))) - BigInt(1)
    const min = signed ? -max - BigInt(1) : BigInt(0)
    if (value > max || value < min)
      throw new IntegerOutOfRangeError({
        max: max.toString(),
        min: min.toString(),
        signed,
        size: size / 8,
        value: value.toString()
      })
  }

  // Simply converting a number into hex value
  return {
    dynamic: false,
    data: [
      numberToHex(value, {
        size: 32,
        signed
      })
    ]
  }
}

// Boolean value is converted into 32 bytes hex
// Example: 0x000...0000001 for true
// Example: 0x000...0000000 for false
const encodeBool = (value: boolean): PreparedParam => {
  if (typeof value !== "boolean")
    throw new BaseError(
      `Invalid boolean value: "${value}" (type: ${typeof value}). Expected: \`true\` or \`false\`.`
    )

  // Simply converting a bool into hex value
  return { dynamic: false, data: [padHex(boolToHex(value))] }
}

// Address value is converted into 32 bytes hex
// Example: 0x000...g132gj1 for false
const encodeAddress = (value: Hex): PreparedParam => {
  if (!isAddress(value)) throw new InvalidAddressError({ address: value })

  // Simply converting a address into hex value
  return { dynamic: false, data: [padHex(value.toLowerCase() as Hex)] }
}

const encodeArray = <const param extends AbiParameter>(
  value: AnyData,
  {
    length,
    param
  }: {
    length: number | null
    param: param
  }
): PreparedParam => {
  // If there is no length mentioned in the array, it is a dynamic array
  const dynamic = length === null

  // this will revert if the value provided is not an array
  // it can in theory be an array of runtime values!
  if (!Array.isArray(value)) throw new InvalidArrayError(value)

  // If there is a length specified, the static array length is validated with its elements count
  if (!dynamic && value.length !== length)
    throw new AbiEncodingArrayLengthMismatchError({
      expectedLength: length!,
      givenLength: value.length,
      type: `${param.type}[${length}]`
    })

  let dynamicChild = false
  const preparedParams: PreparedParam[] = []

  for (let i = 0; i < value.length; i++) {
    // The internal elements are encoded according to its data type.
    const preparedParam = prepareParam({ param, value: value[i] })

    // If any internal data type is dynamic, the array will be treated as dynamic
    // No matter what whether the main array is static or dynamic
    if (preparedParam.dynamic) dynamicChild = true
    preparedParams.push(preparedParam)
  }

  // if the array itself dynamic or child element is dynamic ? The array is treated as dynamic
  if (dynamic || dynamicChild) {
    // Encoding the internal elements
    const data = encodeParams(preparedParams)

    // If the main array itself dynamic and has a atleast one element, the encoding will be
    // length + list of elements appended one after other based on the internal data type encoding
    // If it is a empty dynamic arrray ? zero length is added as encoding
    if (dynamic) {
      const length = numberToHex(preparedParams.length, { size: 32 })
      return {
        dynamic: true,
        data: preparedParams.length > 0 ? [length, ...data] : [length] // The entire array will be placed at the tail
      }
    }

    // If the main array is not dynamic but the child is dynamic ? The child element encoding already
    // handled the length + data while encoding itself. So no need for length here.
    // Array will be placed in head but the element pointer is stored here which points to the values in tail
    if (dynamicChild) return { dynamic: true, data: data }
  }

  // As the encoding for array can be nested as well. But finally we will flatten them
  const data = preparedParams.flatMap(({ data }) => data)

  // If the array is static, the elements are placed in the head with 32 bytes size per element
  return {
    dynamic: false,
    data: data
  }
}

// Static struct usually handled same as static data type and placed in head
// A struct with dynamic data type will be considered as dynamic in nature
const encodeTuple = <
  const param extends AbiParameter & { components: readonly AbiParameter[] }
>(
  value: AbiParameterToPrimitiveType<param>,
  { param }: { param: param }
): PreparedParam => {
  let dynamic = false
  const preparedParams: PreparedParam[] = []

  for (let i = 0; i < param.components.length; i++) {
    const param_ = param.components[i]
    const index = Array.isArray(value) ? i : param_.name
    // The internal elements will be encoded based on its data type. It will handle the nested data type encoding as well
    const preparedParam = prepareParam({
      param: param_,
      value: (value as AnyData)[index!] as readonly unknown[]
    })
    preparedParams.push(preparedParam)
    // If any of the internal element of a tuple is dynamic ? The entire tuple is treated as dynamic tuple
    if (preparedParam.dynamic) dynamic = true
  }

  return {
    dynamic,
    data: dynamic
      ? encodeParams(preparedParams) // If the struct is dynamic, it will be placed in tail with a pointer/offset in head
      : preparedParams.flatMap(({ data }) => data) // If the tuple is static, it is simply placed on after another in head
  }
}

const getArrayComponents = (
  type: string
): [length: number | null, innerType: string] | undefined => {
  const matches = type.match(/^(.*)\[(\d+)?\]$/)
  return matches
    ? // Return `null` if the array is dynamic.
      [matches[2] ? Number(matches[2]) : null, matches[1]]
    : undefined // not an array
}

const encodeParams = (
  preparedParams: PreparedParam[]
): (Hex | RuntimeValue)[] => {
  // 1. Compute the size of the STATIC part of the parameters.
  let staticSize = 0

  for (let i = 0; i < preparedParams.length; i++) {
    const { dynamic, data } = preparedParams[i]

    // If the data type is dynamic, only offset/pointer is placed in the head
    // hence it only requires 32 bytes for head where the actual values will be placed in tail
    if (dynamic) {
      staticSize += 32
    } else {
      // STATIC ARGUMENT
      // Most probably the size of this data array will be one for this instance.
      // However, for arrays, it can be more than one.
      // Calculate the length for all the `data` elements, which are values of Hex or RuntimeValue
      // this length will be used to properly calculate the length of the whole static section
      const len = data.reduce((acc, val) => {
        // if `val` is a RuntimeValue, in theory it can contain both STATIC_CALL and RAW_BYTES InputParams
        // calculate the length for all the inputParams
        if (isRuntimeComposableValue(val)) {
          // val can only be a RuntimeValue in this `if` block
          const inputParamsLength = getRuntimeValueLength(
            (val as RuntimeValue).inputParams
          )
          return acc + inputParamsLength
        }

        // if it is not a RuntimeValue, it is a Hex value. So we just add its length to the accumulator
        return acc + size(val as Hex)
      }, 0)
      staticSize += len
    }
  }

  // 2. Split the parameters into static and dynamic parts.
  const staticParams: (Hex | RuntimeValue)[] = []
  const dynamicParams: (Hex | RuntimeValue)[] = []
  let dynamicSize = 0

  for (let i = 0; i < preparedParams.length; i++) {
    const { dynamic, data } = preparedParams[i]

    // If this is a DYNAMIC ARGUMENT, we will place a offset in head (static section) and the argument itself is placed to the tail
    if (dynamic) {
      // Calculate and push the offset
      // For the first dynamic param, there will be no dynamic value in tail. Which means the dynamic value will be place after all head elements
      // length of all static type are calculated and dynamic value is placed after the calculated length
      // From the next time, the static + dynamic length will be calculated to get a fresh pointer at the last where the dynamic value will be placed
      staticParams.push(
        numberToHex(staticSize + dynamicSize, { size: 32 }) as Hex
      )

      // go over `data` array entries and for each of them calculate the length, then accumulate the length
      // this length will be used to calculate the offset for the next dynamic value
      // `data` is a list of Hex values or RuntimeValues. can contain more than one element
      const len = data.reduce((acc, val) => {
        // if `val` is a RuntimeValue, in theory it can contain both STATIC_CALL and RAW_BYTES InputParams
        // calculate the length for all the inputParams
        if (isRuntimeComposableValue(val)) {
          // val can only be a RuntimeValue in this `if` block
          const inputParamsLength = getRuntimeValueLength(
            (val as RuntimeValue).inputParams
          )
          return acc + inputParamsLength
        }
        // if it is not a RuntimeValue, it is a Hex value. So we just add its length to the accumulator
        return acc + size(val as Hex)
      }, 0)

      // push the `data` items into `dynamicParams` list
      dynamicParams.push(...data)

      // Dynamic length is calculated. It will increase as the number of dynamic values present
      // For every dynamic argument, the pointer placed in head will sum the static size and existing dynamic values to find/point a new place after all
      // existing dynamic arguments
      dynamicSize += len
    } else {
      // if it is a STATIC ARGUMENT, just push the data into staticParams list
      // its length has already been accumulated in `staticSize`
      staticParams.push(...data)
    }
  }

  // 3. Concatenate static and dynamic parts.
  // Static params are placed in head and dynamic params are placed in tail
  return [...staticParams, ...dynamicParams]
}

const prepareParams = <const params extends readonly AbiParameter[]>({
  params,
  values
}: {
  params: params
  values: Array<AnyData>
}): PreparedParam[] => {
  const preparedParams: PreparedParam[] = []
  for (let i = 0; i < params.length; i++) {
    preparedParams.push(prepareParam({ param: params[i], value: values[i] }))
  }
  return preparedParams
}

const prepareParam = <const param extends AbiParameter>({
  param,
  value
}: {
  param: param
  value: AnyData
}): PreparedParam => {
  const runtimeValue = { dynamic: false, data: [value as RuntimeValue] }

  // Detect whether the data type is array or not
  const arrayComponents = getArrayComponents(param.type)

  if (arrayComponents) {
    // If it is array, the length might be some number or null.
    // Null => Dynamic array, Some number => Static array
    const [length, type] = arrayComponents

    // Runtime value is not required to be handled. As the internal types will be the runtime and it will be auto handled when
    // handling the internal fields
    return encodeArray(value, { length, param: { ...param, type } })
  }

  if (param.type === "address") {
    // If the address is runtime value, the encoding is already happened in composability helper, simply return the runtime value
    if (isRuntimeComposableValue(value)) return runtimeValue

    return encodeAddress(value as unknown as Hex)
  }

  if (param.type === "bool") {
    // If the bool is runtime value, the encoding is already happened in composability helper, simply return the runtime value
    if (isRuntimeComposableValue(value)) return runtimeValue

    return encodeBool(value as unknown as boolean)
  }

  if (param.type.startsWith("uint") || param.type.startsWith("int")) {
    // If the uint/int is runtime value, the encoding is already happened in composability helper, simply return the runtime value
    if (isRuntimeComposableValue(value)) return runtimeValue

    const signed = param.type.startsWith("int")
    const [, , size = "256"] = integerRegex.exec(param.type) ?? []
    return encodeNumber(value as unknown as number, {
      signed,
      size: Number(size)
    })
  }

  if (param.type.startsWith("bytes")) {
    // Runtime value is handled inside this function itself
    return encodeBytes(value, { param })
  }

  if (param.type === "string") {
    // If the string is runtime value, the encoding is already happened in composability helper, simply return the runtime value
    if (isRuntimeComposableValue(value)) return runtimeValue

    return encodeString(value as unknown as string)
  }

  if (param.type === "tuple") {
    // Runtime value is not required to be handled. As the internal types will be the runtime and it will be auto handled when
    // handling the internal fields
    return encodeTuple(value as unknown as Tuple, {
      param: param as TupleAbiParameter
    })
  }

  // If none of the type matches, invalid type is specified for encoding, so throw an error
  throw new InvalidAbiEncodingTypeError(param.type, {
    docsPath: "/docs/contract/encodeAbiParameters"
  })
}

export const encodeRuntimeFunctionData = (
  inputs: AbiParameter[],
  args: Array<AnyData>
) => {
  // If there is no arguments to the function, no need for encoding at all.
  if (!inputs || inputs.length === 0) {
    return ["0x" as Hex]
  }

  // If the required inputs and arguments passed is not same, throw an error
  if (inputs.length !== args.length) {
    throw new AbiEncodingLengthMismatchError({
      expectedLength: inputs.length,
      givenLength: args.length
    })
  }

  // Prepare the encoding
  const preparedParams = prepareParams({
    params: inputs,
    values: args as Array<AnyData>
  })

  // Encoding the prepared data types based on static and dynamic natrue
  const data = encodeParams(preparedParams)

  // If there is no data, which means no encoding happened, return 0x
  if (data.length === 0) return ["0x" as Hex]

  // Return theb encoded data. This is not a usual encoding function which returns the funSig + args encoding as a hex
  // It returns only arguments in a array form which is very flexible to handle runtime values
  return data
}

export const getFunctionContextFromAbi = (
  functionSig: string,
  abi: Abi
): FunctionContext => {
  if (abi.length === 0) {
    throw new Error("Invalid ABI")
  }

  const [functionInfo] = abi.filter(
    (item) => item.type === "function" && item.name === functionSig
  )

  if (!functionInfo) {
    throw new Error(`${functionSig} not found on the ABI`)
  }

  const { inputs, name, outputs, stateMutability } = functionInfo as AbiFunction

  return {
    inputs,
    name,
    outputs,
    functionType: ["view", "pure"].includes(stateMutability) ? "read" : "write",
    functionSig: toFunctionSelector(functionInfo as AbiFunction)
  }
}

export const getRuntimeValueLength = (inputParams: InputParam[]) => {
  return inputParams.reduce((acc: number, inputParam: InputParam) => {
    // if it is a STATIC_CALL, we can not know the size beforehand
    // so we will assume it is 32 bytes, as we do not expect non-static types to be used as runtime values
    if (inputParam.fetcherType === InputParamFetcherType.STATIC_CALL) {
      return acc + 32
    }
    // if it is a RAW_BYTES, the length is the length of the paramData
    return acc + size(inputParam.paramData as Hex)
  }, 0)
}
