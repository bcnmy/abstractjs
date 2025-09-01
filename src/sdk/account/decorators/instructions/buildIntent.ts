import type { Address } from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import type { BaseMultichainSmartAccount } from "../../toMultiChainNexusAccount"
import type { MultichainToken } from "../../utils/Types"
import type { BaseInstructionsParams } from "../build"
import buildBridgeInstructions from "../buildBridgeInstructions"
import type { UnifiedERC20Balance } from "../getUnifiedERC20Balance"

/**
 * Parameters for building bridge intent instructions
 * @property depositor - {@link Address} The account address initiating the bridge on the source chain
 * @property recipient - {@link Address} The account address receiving the bridged tokens on the destination chain
 * @property amount - Amount of tokens to bridge as BigInt
 * @property token - Object containing:
 *   @property mcToken - {@link MultichainToken} The multichain token contract to bridge
 *   @property unifiedBalance - {@link UnifiedERC20Balance} The unified token balance across chains
 * @property toChainId - The destination chain id for the bridge operation
 * @property mode - (Optional) "DEBIT" or "OPTIMISTIC" bridging mode
 */
export type BuildIntentParameters = {
  depositor: Address
  recipient: Address
  amount: bigint
  token: {
    mcToken: MultichainToken
    unifiedBalance: UnifiedERC20Balance
  }
  toChainId: number
  mode?: "DEBIT" | "OPTIMISTIC"
}

/**
 * Parameters for building bridge intent instructions
 * @property account - {@link BaseMultichainSmartAccount} The smart account to execute the bridging
 * @property currentInstructions - Array of {@link Instruction} existing instructions to append to
 * @property parameters - {@link BuildIntentParameters} The parameters for building the bridge intent
 */
export type BuildIntentParams = BaseInstructionsParams & {
  parameters: BuildIntentParameters
}

/**
 * Builds bridge intent instructions by checking unified token balance and creating necessary bridge operations
 *
 * @param baseParams - {@link BaseInstructionsParams} Base configuration
 * @param baseParams.account - {@link BaseMultichainSmartAccount} The smart account to execute the bridging
 * @param baseParams.currentInstructions - Array of existing instructions to append to
 * @param parameters - {@link BuildIntentParameters} Bridge configuration
 * @param parameters.depositor - The account address initiating the bridge on the source chain
 * @param parameters.recipient - The account address receiving the bridged tokens on the destination chain
 * @param parameters.amount - The amount to bridge
 * @param parameters.token - Object containing:
 *   @param parameters.token.mcToken - The multichain token contract
 *   @param parameters.token.unifiedBalance - The unified token balance across chains
 * @param parameters.toChainId - The destination chain id
 * @param parameters.mode - (Optional) "DEBIT" or "OPTIMISTIC" bridging mode
 *
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * const bridgeIntentInstructions = await buildIntent(
 *   {
 *     account: myMultichainAccount,
 *     currentInstructions: []
 *   },
 *   {
 *     depositor: "0x...",
 *     recipient: "0x...",
 *     amount: BigInt("1000000"), // 1 USDC
 *     token: {
 *       mcToken: mcUSDC,
 *       unifiedBalance: myUnifiedBalance
 *     },
 *     toChainId: 10
 *   }
 * );
 */
export const buildIntent = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildIntentParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [] } = baseParams
  const {
    amount,
    token: { unifiedBalance },
    toChainId,
    depositor,
    recipient,
    mode
  } = parameters

  const { instructions } = await buildBridgeInstructions({
    depositor,
    recipient,
    amount: amount,
    toChainId,
    unifiedBalance,
    mode
  })

  return [...currentInstructions, ...instructions]
}

export default buildIntent
