import type { Address, Hex } from "viem"
import { isAddress } from "viem"
import type {
  Instruction,
  InstructionLevelTimeBounds
} from "../../../clients/decorators/mee"
import type { InstructionMetadata } from "../../../clients/decorators/mee/types/instruction-metadata.type"
import { ComposabilityVersion } from "../../../constants"
import {
  type ComposableCall,
  type InputParam,
  isRuntimeComposableValue,
  prepareRawComposableParams
} from "../../../modules/utils/composabilityCalls"
import type { RuntimeValue } from "../../../modules/utils/runtimeAbiEncoding"
import type { BaseInstructionsParams, ComposabilityParams } from "../build"
import { formatComposableCallWithVersion } from "./buildComposable"

/**
 * Parameters for building a raw composable instruction
 */
export type BuildRawComposableParameters = {
  to: Address | RuntimeValue
  calldata: Hex
  chainId: number
  gasLimit?: bigint
  value?: bigint | RuntimeValue
  metadata?: InstructionMetadata[]
} & InstructionLevelTimeBounds

/**
 * Builds an instruction for raw composable transaction. This is a generic function which creates the raw composable instructions
 * to execute against composability stack
 *
 * @param baseParams - Base configuration for the instruction
 * @param baseParams.account - The account that will execute the composable transaction
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - Parameters for generate composable instruction
 * @param parameters.to - Address of the target contract address
 * @param parameters.calldata - Raw calldata of the solidity function call
 * @param parameters.chainId - Chain where the composable transaction will be executed
 * @param [parameters.gasLimit] - Optional gas limit
 * @param [parameters.value] - Optional value
 *
 * @returns Promise resolving to array of instructions
 *
 * @example
 * ```typescript
 * const instructions = buildRawComposable(
 *   { accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
 *   {
 *     to: targetContractAddress,
 *     calldata: '0x000000',
 *     chainId: baseSepolia.id
 *   }
 * )
 * ```
 */
export const buildRawComposable = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildRawComposableParameters,
  composabilityParameters: ComposabilityParams
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const {
    to,
    calldata,
    gasLimit,
    value,
    chainId,
    metadata,
    lowerBoundTimestamp,
    upperBoundTimestamp,
    executionSimulationRetryDelay
  } = parameters
  const { composabilityVersion } = composabilityParameters

  if (!composabilityVersion) {
    throw new Error(`Composability version is required to build a composable call.
      This error may be caused by using a non-composable .build decorator with a composable call.
      Please use buildComposable instead.`)
  }

  if (calldata.length < 10 || !calldata.startsWith("0x")) {
    throw new Error("Invalid calldata")
  }

  const functionSig = calldata.slice(0, 10) as Hex
  const callDataEncodedArgs = `0x${calldata.slice(10)}` as Hex

  let versionAgnosticComposableParams: InputParam[] = []
  if (callDataEncodedArgs.length !== 0) {
    versionAgnosticComposableParams =
      prepareRawComposableParams(callDataEncodedArgs)
  }

  // Handle different composability versions - add constraints for v1.0.0
  if (composabilityVersion === ComposabilityVersion.V1_0_0) {
    if (isRuntimeComposableValue(to)) {
      throw new Error(
        "Runtime injected target is not supported for Composability v1.0.0"
      )
    }
    if (!isAddress(to as Address)) {
      throw new Error("Invalid target contract address")
    }
    if (isRuntimeComposableValue(value)) {
      throw new Error(
        "Runtime injected value is not supported for Composability v1.0.0"
      )
    }
  }

  const composableCall: ComposableCall = formatComposableCallWithVersion(
    composabilityVersion,
    false, // efficientMode is false for raw composable calls
    versionAgnosticComposableParams,
    functionSig,
    to,
    value,
    gasLimit
  )

  const defaultMetadata: InstructionMetadata[] = [
    {
      type: "CUSTOM",
      description: "Custom composable on-chain action",
      chainId
    }
  ]

  return [
    ...currentInstructions,
    {
      calls: [composableCall],
      chainId,
      isComposable: true,
      metadata: metadata || defaultMetadata,
      lowerBoundTimestamp,
      upperBoundTimestamp,
      executionSimulationRetryDelay
    }
  ]
}

export default buildRawComposable
