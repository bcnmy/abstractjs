import type { Chain } from "viem"
import type { Instruction } from "../../clients/decorators/mee"

type OneClickDepositParams<TParams = object> = {
  sourceChain: Chain
  destChain: Chain
} & TParams

/**
 * The return type of sourceChainInstructions/bridgeInstructions/destChainInstructions
 * can be either a single instruction or an array of instructions in case of multiple steps per template funciton
 * @example
 * instructions: `mcAaveV3Pool.build` returns a single instruction
 * instructions[]: `nexus.build` returns an array of instructions
 * instructions[][]: `[nexus.build, nexus.build]` add multiple `nexus.build` calls inside one template function
 */
type TemplateFunctionReturnType = Instruction | Instruction[] | Instruction[][]

type OneClickDepositTemplate<TParams = object> = {
  sourceChainInstructions?: ({
    sourceChain,
    destChain,
    ...params
  }: {
    sourceChain: Chain
    destChain: Chain
  } & TParams) => Promise<TemplateFunctionReturnType>
  bridgeInstructions?: ({
    sourceChain,
    destChain,
    ...params
  }: {
    sourceChain: Chain
    destChain: Chain
  } & TParams) => Promise<TemplateFunctionReturnType>
  destChainInstructions?: ({
    sourceChain,
    destChain,
    ...params
  }: {
    sourceChain: Chain
    destChain: Chain
  } & TParams) => Promise<TemplateFunctionReturnType>
}

/**
 * Create a one click deposit template. Can be customized with type parameters to add additional parameters to the template.
 * @param params - The parameters for the template
 * @param params.sourceChainInstructions - The instructions for the source chain
 * @param params.bridgeInstructions - The instructions for the bridge
 * @param params.destChainInstructions - The instructions for the destination chain
 * @returns A function that returns the instructions for the template
 *
 * @example
 *  const oneClick = createOneClickDepositTemplate<{ amount: bigint }>({
 *   sourceChainInstructions: async ({ sourceChain, destChain, amount }) => {
 *     ...
 *   },
 *   bridgeInstructions: async ({ sourceChain, destChain, amount }) => {
 *     ...
 *   },
 *   destChainInstructions: async ({ sourceChain, destChain, amount }) => {
 *     ...
 *   }
 * })
 * const instructions = await oneClick({
 *   sourceChain: paymentChain,
 *   destChain: targetChain,
 *   amount: amountConsumed
 * })
 * const fusionQuote = await meeClient.getFusionQuote({
 *   instructions,
 *   ...
 * })
 */
export const createOneClickDepositTemplate = <TParams = object>(
  params: OneClickDepositTemplate<TParams>
) => {
  return async (depositParams: OneClickDepositParams<TParams>) => {
    const { sourceChain, destChain, ...restParams } = depositParams
    const typedRestParams = restParams as TParams

    const sourceInstructions = await params.sourceChainInstructions?.({
      sourceChain,
      destChain,
      ...typedRestParams
    })

    const bridgeInstructions = await params.bridgeInstructions?.({
      sourceChain,
      destChain,
      ...typedRestParams
    })

    const destInstructions = await params.destChainInstructions?.({
      sourceChain,
      destChain,
      ...typedRestParams
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
