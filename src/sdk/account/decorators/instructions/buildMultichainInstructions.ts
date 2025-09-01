import { erc7579Calls } from "../../../clients/decorators/erc7579"
import type { AbstractCall, Instruction } from "../../../clients/decorators/mee"
import { smartAccountCalls } from "../../../clients/decorators/smartAccount"
import type { AnyData, ModularSmartAccount } from "../../../modules/utils/Types"
import { ownableCalls } from "../../../modules/validators/ownable/decorators"
import { smartSessionCalls } from "../../../modules/validators/smartSessions"
import type { Call } from "../../utils/Types"
import type { BaseInstructionsParams } from "../build"

/**
 * A collection of all globally composable calls from various modules and decorators.
 */
export const GLOBAL_COMPOSABLE_CALLS = {
  ...erc7579Calls,
  ...smartAccountCalls,
  ...ownableCalls,
  ...smartSessionCalls
} as const

export type SupportedCall = keyof typeof GLOBAL_COMPOSABLE_CALLS

// biome-ignore lint/complexity/noBannedTypes: Later inference will be used
export type MultichainInstructionArgumentTypes<F extends Function> = F extends (
  account: ModularSmartAccount,
  args: infer A
) => AnyData
  ? A
  : never

/**
 * Parameters for building multichain instructions.
 * @property calls - Array of Call objects to be included in each instruction.
 * @property chainIds - Array of chain IDs for which instructions will be built.
 */
export type BuildMultichainInstructionsParameters = {
  calls: Call[]
  chainIds: number[]
}

/**
 * Builds instructions for multiple chains, appending them to any existing instructions.
 *
 * @param baseParams - Base parameters for instruction building.
 * @param parameters - Object containing:
 *   - calls: Array of Call objects to include in each instruction.
 *   - chainIds: Array of chain IDs for which to build instructions.
 * @returns Promise resolving to an array of Instruction objects, including any existing instructions.
 */
export const buildMultichainInstructions = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildMultichainInstructionsParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const { calls, chainIds } = parameters

  const instructions = await Promise.all(
    chainIds.map(async (chainId) => {
      let callsPerChain: AbstractCall[] = []

      if (calls) {
        callsPerChain = calls as AbstractCall[]
      }

      return { calls: callsPerChain, chainId }
    })
  )

  return [...currentInstructions, ...instructions]
}

export default buildMultichainInstructions
