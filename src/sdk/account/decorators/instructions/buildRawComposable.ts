import { type Address, type Hex, isAddress } from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import {
  type ComposableCall,
  type InputParam,
  prepareRawComposableParams
} from "../../../modules/utils/composabilityCalls"
import type { BaseInstructionsParams } from "../build"

/**
 * Parameters for building a raw composable instruction
 */
export type BuildRawComposableParameters = {
  to: Address
  calldata: Hex
  chainId: number
  gasLimit?: bigint
  value?: bigint
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
  parameters: BuildRawComposableParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const { to, calldata, gasLimit, value, chainId } = parameters

  if (!isAddress(to)) {
    throw new Error("Invalid target contract address")
  }

  if (calldata.length < 10 || !calldata.startsWith("0x")) {
    throw new Error("Invalid calldata")
  }

  const functionSig = calldata.slice(0, 10) as Hex

  const composableParams: InputParam[] = prepareRawComposableParams(
    `0x${calldata.slice(10)}` as Hex
  )

  const composableCalls: ComposableCall[] = []

  const composableCall: ComposableCall = {
    to,
    value: value ?? BigInt(0),
    functionSig,
    inputParams: composableParams,
    outputParams: [], // In the current scope, output params are not handled. When more composability functions are added, this will change
    ...(gasLimit ? { gasLimit } : {})
  }

  composableCalls.push(composableCall)

  return [
    ...currentInstructions,
    {
      calls: composableCalls,
      chainId,
      isComposable: true
    }
  ]
}

export default buildRawComposable
