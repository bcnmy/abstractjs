import type {
  Instruction,
  SupertransactionLike
} from "../../clients/decorators/mee/getQuote"

/**
 * @internal
 * Resolves instructions to an array of instructions
 * @param instructions - The instructions to resolve
 * @returns The resolved instructions
 */
export const resolveInstructions = async (
  instructions: SupertransactionLike["instructions"]
): Promise<Instruction[]> => {
  return (
    await Promise.all(
      instructions
        .flatMap((iIs) =>
          typeof iIs === "function"
            ? (iIs as () => Promise<Instruction[]>)()
            : iIs
        )
        .filter(Boolean)
    )
  ).flat()
}
