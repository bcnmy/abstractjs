import type { Chain, erc20Abi } from "viem"
import { MultichainSmartAccount } from "../../account-vendors"
import { AcrossPlugin } from "../../plugins/across.plugin"
import { Instruction } from "../../workflow"
import type { MultichainContract } from "../contract/getMultichainContract"
import { getUnifiedERC20Balance } from "../contract/getUnifiedERC20Balance"
import { buildMultichainBridgingInstructions } from "./bridging-builder"
import type { ContextualInstruction } from "./supertransaction-builder.util"

export type RequireFundsParams = {
  amount: bigint
  token: MultichainContract<typeof erc20Abi>
  chain: Chain
}

/**
 * Makes sure that the user has enough funds on the selected chain before filling the
 * supertransaction. Bridges funds from other chains if needed.
 *
 * @param account - The account that will execute the transaction
 * @param params - Configuration for the balance requirement
 * @returns Instructions for any required bridging operations
 */
export const requireErc20Balance = async (
  params: RequireFundsParams
): Promise<ContextualInstruction> => {
  return async (context) => {
    if (!context.account) {
      throw Error(`
        Account must be the first function called in the 
        Supertranscation builder. Now calling requireErc20Balance,
        before account was injected.  
      `)
    }
    const unifiedBalance = await getUnifiedERC20Balance({
      multichainAccount: context.account,
      multichainERC20: params.token
    })

    const result = await buildMultichainBridgingInstructions({
      amount: params.amount,
      bridgingPlugins: [AcrossPlugin],
      multichainAccount: context.account,
      toChain: params.chain,
      unifiedBalance: unifiedBalance
    })

    return result.instructions.map((instruction) => instruction.userOp)
  }
}
