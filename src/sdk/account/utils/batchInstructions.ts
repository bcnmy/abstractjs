import type { Address } from "viem"
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import { buildBatch } from "../decorators/instructions/buildBatch"

type BatchInstructionsParameters = {
  /**
   * The account address to execute the instructions on.
   */
  accountAddress: Address
  /**
   * The remaining instructions to be executed.
   */
  instructions: Instruction[]
}

/**
 * Groups all the instructions with the same chainId into batches.
 *
 * @param parameters - The parameters for the batching.
 * @param parameters.accountAddress - The account address to execute the instructions on.
 * @param parameters.triggerCall - The first instruction to be executed.
 * @param parameters.instructions - The remaining instructions to be executed.
 *
 * @returns An array of instructions, where all the same-chain instructions are batched together.
 */
export const batchInstructions = async (
  parameters: BatchInstructionsParameters
): Promise<Instruction[]> => {
  const { accountAddress, instructions } = parameters

  const result: Instruction[] = []

  const batchesByChainId = new Map<string, Instruction[]>()
  const chainIds = new Set<string>()

  for (const instruction of instructions) {
    const chainId = String(instruction.chainId)
    chainIds.add(chainId)

    const batch = batchesByChainId.get(chainId) || []
    batch.push(instruction)
    batchesByChainId.set(chainId, batch)
  }

  for (const chainId of [...chainIds]) {
    const batch = batchesByChainId.get(chainId) || []

    if (batch.length > 1) {
      const [batchedOp] = await buildBatch(
        { accountAddress },
        { instructions: batch }
      )

      result.push(batchedOp)
    } else {
      result.push(...batch)
    }
  }

  return result
}
