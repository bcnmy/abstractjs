import type {
  AbstractCall,
  Instruction,
  InstructionLike
} from "../../../clients/decorators/mee"
import type { AnyData, ComposableCall } from "../../../modules"
import { resolveInstructions } from "../../utils"
import type { BaseInstructionsParams } from "../build"

/**
 * Parameters for building a transfer instruction
 */
export type BuildBatchParameters = {
  instructions: InstructionLike[]
}

/**
 * Parameters for the buildBatch function
 */
export type BuildBatchParams = BaseInstructionsParams & {
  /**
   * Parameters specific to the transfer instruction
   * @see {@link BuildBatchParameters}
   */
  parameters: BuildBatchParameters
}

/**
 * Builds a batch of instructions for a single userOp to be included in a supertransaction
 * UserOps must be on the same chain for the batch to be valid
 * @param baseParams - Base parameters for the instruction
 * @param parameters - Parameters for the batch instruction
 * @param parameters.instructions - Instructions to be executed in the batch
 * @returns The built instruction
 *
 * @example
 * ```typescript
 * const instructions = await buildBatch(
 *   { accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
 *   { instructions: [buildApprove, buildSwap] }
 * )
 * ```
 */
export const buildBatch = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildBatchParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const { instructions } = parameters

  if (instructions.length < 2) {
    throw new Error("A Batch must contain at least 2 instructions")
  }

  const resolvedInstructions = await resolveInstructions(instructions)

  if (
    resolvedInstructions.some(
      ({ chainId }) =>
        Number(chainId) !== Number(resolvedInstructions[0].chainId)
    )
  ) {
    throw new Error("All instructions must be on the same chain")
  }

  const isComposable = resolvedInstructions.some(
    ({ isComposable }) => isComposable === true
  )

  // If any one instruction in a batch is composable, every other instructions should follow composable encoding.
  if (
    !resolvedInstructions.every((inx) => !!inx.isComposable === !!isComposable)
  ) {
    throw new Error(
      `${isComposable ? "All the instructions must be built with buildComposable in order to support the runtime time parameters." : "All the instructions must be non composable when there are no runtime parameters"}`
    )
  }

  const calls: AbstractCall[] | ComposableCall[] = resolvedInstructions.flatMap(
    ({ calls }) => calls as AnyData
  )

  return [
    ...currentInstructions,
    {
      calls: isComposable
        ? (calls as ComposableCall[])
        : (calls as AbstractCall[]),
      chainId: resolvedInstructions[0].chainId, // Batch instructions must be on the same chain
      isComposable
    }
  ]
}

export default buildBatch
