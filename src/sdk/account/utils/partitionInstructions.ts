import type {
  Instruction,
  InstructionLike
} from "../../clients/decorators/mee/getQuote"
import { buildBatch } from "../decorators/instructions/buildBatch"
import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"
import { resolveInstructions } from "./resolveInstructions"

type PartitionInstructionsParameters = {
  /**
   * The account to execute the instructions on.
   */
  account: MultichainSmartAccount
  /**
   * The first instruction to be executed.
   */
  triggerCall: InstructionLike
  /**
   * The remaining instructions to be executed.
   */
  instructions: InstructionLike[]
}

/**
 * Partitions instructions into an initial batch and remaining instructions.
 * The first instruction is executed as a batch, and the remaining instructions are executed as they are.
 * This is useful for executing a fusion transaction, where the first instruction is a trigger.
 *
 * @param parameters - The parameters for the partition.
 * @param parameters.account - The account to execute the instructions on.
 * @param parameters.triggerCall - The first instruction to be executed.
 * @param parameters.instructions - The remaining instructions to be executed.
 *
 * @returns An array of instructions, where the first instruction is the initial batch and the rest are the remaining instructions.
 *
 * @example
 * ```typescript
 * const instructions = await partitionInstructions({ account, triggerCall, instructions })
 * ```
 */
export const partitionInstructions = async (
  parameters: PartitionInstructionsParameters
): Promise<Instruction[]> => {
  const { account, triggerCall, instructions } = parameters
  const allInstructions = await resolveInstructions([
    triggerCall,
    ...instructions
  ])
  const chainIdForInitialBatch = allInstructions[0].chainId
  const mismatchIndex = allInstructions.findIndex(
    ({ chainId }) => Number(chainId) !== Number(chainIdForInitialBatch)
  )
  const instructionsForInitialBatch = allInstructions.slice(0, mismatchIndex)

  if (instructionsForInitialBatch && instructionsForInitialBatch.length > 1) {
    const remainingInstructions = allInstructions.slice(mismatchIndex)
    const [initialUserOp] = await buildBatch(
      { account },
      {
        instructions: instructionsForInitialBatch
      }
    )
    return [initialUserOp, ...remainingInstructions]
  }

  return allInstructions
}
