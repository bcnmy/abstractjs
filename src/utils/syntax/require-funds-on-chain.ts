import type { Address, Chain, erc20Abi } from "viem"
import type { MultichainSmartAccount } from "../../account-vendors"
import { AcrossPlugin } from "../../plugins/across.plugin"
import type { MultichainContract } from "../contract/getMultichainContract"
import { getUnifiedERC20Balance } from "../contract/getUnifiedERC20Balance"
import { buildMultichainBridgingInstructions } from "./bridging-builder"
import type { Instruction } from "../../decorators/getQuote"

/**
 * Internal state of the supertransaction builder.
 * Collects both immediate instructions and promises of future instructions
 * which will be resolved at finalization time.
 */
export type SupertransactionState = {
  account?: MultichainSmartAccount
  gasToken?: Address
  gasChain?: number
  instructions: Instruction[]
  /** Holds promises of instructions that will be resolved when finalizing */
  pendingInstructions: Promise<Instruction[]>[]
}

/**
 * A function that can be used to add instructions to the supertransaction.
 * @param context - The current state of the supertransaction builder
 * @returns The instructions to add to the supertransaction
 */
export type ContextualInstruction = (
  context: SupertransactionState
) => Promise<Instruction[]>

/**
 * Parameters for the requireErc20Balance function
 */
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
