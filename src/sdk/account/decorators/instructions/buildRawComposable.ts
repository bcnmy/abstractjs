import type { Address, Hex } from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import {
  type ComposableCall,
  type InputParam,
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
}

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
  const { to, calldata, gasLimit, value, chainId } = parameters
  const { composabilityVersion } = composabilityParameters

  if (calldata.length < 10 || !calldata.startsWith("0x")) {
    throw new Error("Invalid calldata")
  }

  const functionSig = calldata.slice(0, 10) as Hex
  const callDataEncodedArgs = calldata.slice(10) as Hex

  let versionAgnosticComposableParams: InputParam[] = []
  if (callDataEncodedArgs.length !== 0) {
    versionAgnosticComposableParams =
      prepareRawComposableParams(callDataEncodedArgs)
  }

  const composableCall: ComposableCall = formatComposableCallWithVersion(
    composabilityVersion!,
    false, // efficientMode is false for raw composable calls
    versionAgnosticComposableParams,
    functionSig,
    to,
    value,
    gasLimit
  )

  return [
    ...currentInstructions,
    {
      calls: [composableCall],
      chainId,
      isComposable: true
    }
  ]
}

export default buildRawComposable
