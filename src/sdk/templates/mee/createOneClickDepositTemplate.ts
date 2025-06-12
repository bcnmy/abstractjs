import type { Chain } from "viem"
import type { Instruction } from "../../clients/decorators/mee"

type OneClickDepositParams = {
  sourceChain: Chain
  destChain: Chain
  amount: bigint
}

/**
 * The return type of sourceChainInstructions/bridgeInstructions/destChainInstructions
 * can be either a single instruction or an array of instructions in case of multiple steps per template funciton
 * @example
 * instructions: `mcAaveV3Pool.build` returns a single instruction
 * instructions[]: `nexus.build` returns an array of instructions
 * instructions[][]: `[nexus.build, nexus.build]` add multiple `nexus.build` calls inside one template function
 */
type TemplateFunctionReturnType = Instruction | Instruction[] | Instruction[][]

type OneClickDepositTemplate = {
  sourceChainInstructions?: ({
    chain,
    amount
  }: {
    chain: Chain
    amount: bigint
  }) => Promise<TemplateFunctionReturnType>
  bridgeInstructions?: ({
    sourceChain,
    destChain,
    amount
  }: {
    sourceChain: Chain
    destChain: Chain
    amount: bigint
  }) => Promise<TemplateFunctionReturnType>
  destChainInstructions?: ({
    chain,
    amount
  }: {
    chain: Chain
    amount: bigint
  }) => Promise<TemplateFunctionReturnType>
}

/**
 * Create a one click deposit template
 * @param params - The parameters for the template
 * @param params.sourceChainInstructions - The instructions for the source chain
 * @param params.bridgeInstructions - The instructions for the bridge
 * @param params.destChainInstructions - The instructions for the destination chain
 * @returns A function that returns the instructions for the template
 *
 * @example
 *  const morphoToAave = createOneClickDepositTemplate({
 *   sourceChainInstructions: async ({ chain, amount }) => {
 *     ...
 *   },
 *   bridgeInstructions: async ({ sourceChain, destChain, amount }) => {
 *     ...
 *   },
 *   destChainInstructions: async ({ chain, amount }) => {
 *     ...
 *   }
 * })
 * const instructions = await morphoToAave({
 *   sourceChain: paymentChain,
 *   destChain: targetChain,
 *   amount: amountConsumed
 * })
 * const fusionQuote = await meeClient.getFusionQuote({
 *   instructions,
 *   ...
 * })
 */
export const createOneClickDepositTemplate = (
  params: OneClickDepositTemplate
) => {
  return async (depositParams: OneClickDepositParams) => {
    const { sourceChain, destChain, amount } = depositParams

    const sourceInstructions = await params.sourceChainInstructions?.({
      chain: sourceChain,
      amount
    })

    const bridgeInstructions = await params.bridgeInstructions?.({
      sourceChain,
      destChain,
      amount
    })

    const destInstructions = await params.destChainInstructions?.({
      chain: destChain,
      amount
    })

    const allInstructions: Instruction[] = []
    if (sourceInstructions) {
      if (Array.isArray(sourceInstructions)) {
        allInstructions.push(...sourceInstructions.flat())
      } else {
        allInstructions.push(sourceInstructions)
      }
    }
    if (bridgeInstructions) {
      if (Array.isArray(bridgeInstructions)) {
        allInstructions.push(...bridgeInstructions.flat())
      } else {
        allInstructions.push(bridgeInstructions)
      }
    }
    if (destInstructions) {
      if (Array.isArray(destInstructions)) {
        allInstructions.push(...destInstructions.flat())
      } else {
        allInstructions.push(destInstructions)
      }
    }

    return allInstructions
  }
}
