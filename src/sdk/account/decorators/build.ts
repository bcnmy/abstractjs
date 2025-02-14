import type { Instruction } from "../../clients/decorators/mee/getQuote"
import type { BaseMultichainSmartAccount } from "../toMultiChainNexusAccount"
import {
  type BuildApproveParameters,
  buildApprove
} from "./instructions/buildApprove"
import buildBatch, {
  type BuildBatchParameters
} from "./instructions/buildBatch"
import {
  type BuildDefaultParameters,
  buildDefaultInstructions
} from "./instructions/buildDefaultInstructions"
import {
  type BuildIntentParameters,
  buildIntent
} from "./instructions/buildIntent"
import {
  type BuildTransferParameters,
  buildTransfer
} from "./instructions/buildTransfer"
import {
  type BuildTransferFromParameters,
  buildTransferFrom
} from "./instructions/buildTransferFrom"
import buildWithdrawal, {
  type BuildWithdrawalParameters
} from "./instructions/buildWithdrawal"

/**
 * Base parameters for building instructions
 * @property account - {@link BaseMultichainSmartAccount} The multichain smart account to check balances for
 * @property currentInstructions - {@link Instruction[]} Optional array of existing instructions to append to
 */
export type BaseInstructionsParams = {
  account: BaseMultichainSmartAccount
  currentInstructions?: Instruction[]
}

/**
 * Default build action which is used to build instructions for a chain
 * @property type - Literal "default" to identify the action type
 * @property data - {@link BuildDefaultInstructionsParams} The parameters for the action
 */
export type BuildDefaultInstruction = {
  type: "default"
  data: BuildDefaultParameters
}

/**
 * Bridge build action which is used to build instructions for bridging funds from other chains
 * @property type - Literal "intent" to identify the action type
 * @property data - {@link BuildIntentParams} The parameters for the bridge action
 */
export type BuildIntentInstruction = {
  type: "intent"
  data: BuildIntentParameters
}

/**
 * Trigger build action which is used to build instructions for triggering a transfer
 * @property type - Literal "trigger" to identify the action type
 * @property data - {@link BuildTransferFromParameters} The parameters for the trigger action
 */
export type BuildTransferFromInstruction = {
  type: "transferFrom"
  data: BuildTransferFromParameters
}

/**
 * Build action which is used to build instructions for a transfer
 * @property type - Literal "transfer" to identify the action type
 * @property data - {@link BuildTransferParameters} The parameters for the transfer action
 */
export type BuildTransferInstruction = {
  type: "transfer"
  data: BuildTransferParameters
}

/**
 * Build action which is used to build instructions for an approval
 * @property type - Literal "approve" to identify the action type
 * @property data - {@link BuildApproveParameters} The parameters for the approval action
 */
export type BuildApproveInstruction = {
  type: "approve"
  data: BuildApproveParameters
}

/**
 * Build action which is used to build instructions for a withdrawal
 * @property type - Literal "withdrawal" to identify the action type
 * @property data - {@link BuildWithdrawalParameters} The parameters for the withdrawal action
 */
export type BuildWithdrawalInstruction = {
  type: "withdrawal"
  data: BuildWithdrawalParameters
}

/**
 * Build action which is used to build instructions for a batch
 * @property type - Literal "batch" to identify the action type
 * @property data - {@link BuildBatchParameters} The parameters for the batch action
 */
export type BuildBatchInstruction = {
  type: "batch"
  data: BuildBatchParameters
}

/**
 * Union type of all possible build instruction types
 */
export type BuildInstructionTypes =
  | BuildDefaultInstruction
  | BuildIntentInstruction
  | BuildTransferFromInstruction
  | BuildTransferInstruction
  | BuildApproveInstruction
  | BuildWithdrawalInstruction
  | BuildBatchInstruction
/**
 * Builds transaction instructions based on the provided action type and parameters
 *
 * @param baseParams - {@link BaseInstructionsParams} Base configuration for instructions
 * @param baseParams.account - The multichain smart account to check balances for
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - {@link BuildInstructionTypes} The build action configuration
 * @param parameters.type - The type of build action ("default" | "intent")
 * @param parameters.data - Action-specific parameters based on the type
 *
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * // Bridge tokens example
 * const bridgeInstructions = await build(
 *   { account: myMultichainAccount },
 *   {
 *     type: "intent",
 *     data: {
 *       amount: BigInt(1000000),
 *       mcToken: mcUSDC,
 *       toChain: optimism
 *     }
 *   }
 * );
 *
 * @example
 * // Default action example
 * const defaultInstructions = await build(
 *   { account: myMultichainAccount },
 *   {
 *     type: "default",
 *     data: {
 *       instructions: myExistingInstruction
 *     }
 *   }
 * );
 */
export const build = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildInstructionTypes
): Promise<Instruction[]> => {
  const { type, data } = parameters

  switch (type) {
    case "intent": {
      return buildIntent(baseParams, data)
    }
    case "default": {
      return buildDefaultInstructions(baseParams, data)
    }
    case "transferFrom": {
      return buildTransferFrom(baseParams, data)
    }
    case "transfer": {
      return buildTransfer(baseParams, data)
    }
    case "approve": {
      return buildApprove(baseParams, data)
    }
    case "withdrawal": {
      return buildWithdrawal(baseParams, data)
    }
    case "batch": {
      return buildBatch(baseParams, data)
    }
    default: {
      throw new Error(`Unknown build action type: ${type}`)
    }
  }
}

export default build
