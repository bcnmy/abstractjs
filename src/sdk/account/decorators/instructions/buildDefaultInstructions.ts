import type { Instruction } from "../../../clients/decorators/mee"
import type { BaseInstructionsParams } from "../build"

/**
 * Parameters for building default instructions
 * @property instructions - Single {@link Instruction} or array of instructions to add
 */
export type BuildDefaultParameters = Instruction[] | Instruction

/**
 * Builds a base set of instructions by combining existing instructions with new ones
 *
 * @param baseParams - {@link BaseInstructionsParams} Base configuration
 * @param params - {@link BuildDefaultParams} Instructions configuration
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * // Adding a single instruction
 * const instructions = await buildDefaultInstructions(
 *   { currentInstructions: existingInstructions },
 *   { instructions: newInstruction }
 * );
 */
export const buildDefaultInstructions = async (
  baseParams: BaseInstructionsParams,
  instructions: BuildDefaultParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  return [
    ...currentInstructions,
    ...(Array.isArray(instructions) ? instructions : [instructions])
  ]
}

export default buildDefaultInstructions
