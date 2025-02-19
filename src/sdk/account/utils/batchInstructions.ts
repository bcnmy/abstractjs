import type {
  Instruction,
  InstructionLike
} from "../../clients/decorators/mee/getQuote"
import { buildBatch } from "../decorators/instructions/buildBatch"
import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"
import { resolveInstructions } from "./resolveInstructions"

type BatchInstructionsParameters = {
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
 * Groups consecutive instructions with the same chainId into batches.
 * Instructions can only be batched if they are consecutive and share the same chainId.
 *
 * @param parameters - The parameters for the batching.
 * @param parameters.account - The account to execute the instructions on.
 * @param parameters.triggerCall - The first instruction to be executed.
 * @param parameters.instructions - The remaining instructions to be executed.
 *
 * @returns An array of instructions, where consecutive same-chain instructions are batched together.
 */
export const batchInstructions = async (
  parameters: BatchInstructionsParameters
): Promise<Instruction[]> => {
  const { account, triggerCall, instructions } = parameters
  const allInstructions = await resolveInstructions([
    triggerCall,
    ...instructions
  ])

  const result: Instruction[] = []
  let currentBatch: Instruction[] = []
  let currentChainId: string | null = null

  for (const instruction of allInstructions) {
    const chainId = String(instruction.chainId)

    if (currentChainId === null || chainId === currentChainId) {
      currentBatch.push(instruction)
      currentChainId = chainId
    } else {
      // Chain ID changed, process current batch
      if (currentBatch.length > 1) {
        const [batchedOp] = await buildBatch(
          { account },
          { instructions: currentBatch }
        )
        result.push(batchedOp)
      } else if (currentBatch.length === 1) {
        result.push(currentBatch[0])
      }

      // Start new batch with current instruction
      currentBatch = [instruction]
      currentChainId = chainId
    }
  }

  // Process the final batch
  if (currentBatch.length > 1) {
    const [batchedOp] = await buildBatch(
      { account },
      { instructions: currentBatch }
    )
    result.push(batchedOp)
  } else if (currentBatch.length === 1) {
    result.push(currentBatch[0])
  }

  return result
}
