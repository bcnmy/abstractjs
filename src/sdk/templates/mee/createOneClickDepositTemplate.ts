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
 */
type TemplateFunctionReturnType = Instruction[] | Instruction[][]

type OneClickDepositTemplate = {
  sourceChainInstructions?: ({
    chain
  }: {
    chain: Chain
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
    chain
  }: {
    chain: Chain
  }) => Promise<TemplateFunctionReturnType>
}

/**
 * Create a one click deposit template
 * @param params - The parameters for the template
 * @param params.sourceChainInstructions - The instructions for the source chain
 * @param params.bridgeInstructions - The instructions for the bridge
 * @param params.destChainInstructions - The instructions for the destination chain
 * @returns A function that returns the instructions for the template
 */
export const createOneClickDepositTemplate = (
  params: OneClickDepositTemplate
) => {
  return async (depositParams: OneClickDepositParams) => {
    const { sourceChain, destChain, amount } = depositParams

    const sourceInstructions = await params.sourceChainInstructions?.({
      chain: sourceChain
    })

    const bridgeInstructions = await params.bridgeInstructions?.({
      sourceChain,
      destChain,
      amount
    })

    const destInstructions = await params.destChainInstructions?.({
      chain: destChain
    })

    // Combine all instructions
    const allInstructions = [
      ...(sourceInstructions || []).flat(),
      ...(bridgeInstructions || []).flat(),
      ...(destInstructions || []).flat()
    ]

    return allInstructions
  }
}
