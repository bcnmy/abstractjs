import type { Address } from "viem"
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import type { ComposabilityVersion } from "../../constants"
import type { RuntimeValue } from "../../modules"
import { isRuntimeComposableValue } from "../../modules/utils/composabilityCalls"
import buildAcrossIntentComposable, {
  type BuildAcrossIntentComposableParams
} from "./instructions/buildAcrossIntentComposable"
import {
  type BuildApproveParameters,
  buildApprove
} from "./instructions/buildApprove"
import buildBatch, {
  type BuildBatchParameters
} from "./instructions/buildBatch"
import {
  type BuildComposableParameters,
  type BuildNativeTokenTransferComposableParameters,
  buildComposableUtil
} from "./instructions/buildComposable"
import {
  type BuildDefaultParameters,
  buildDefaultInstructions
} from "./instructions/buildDefaultInstructions"
import {
  type BuildIntentParameters,
  buildIntent
} from "./instructions/buildIntent"
import {
  type BuildMultichainInstructionsParameters,
  buildMultichainInstructions
} from "./instructions/buildMultichainInstructions"
import buildRawComposable, {
  type BuildRawComposableParameters
} from "./instructions/buildRawComposable"
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
 * Parameters for a token builders
 */
export type TokenParams = {
  /**
   * The address of the token to use on the relevant chain
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
   */
  tokenAddress: Address | RuntimeValue
  /**
   * The chainId to use
   * @example 1 // Ethereum Mainnet
   */
  chainId: number
  /**
   * Amount of the token to use, in the token's smallest unit
   * @example 1000000n // 1 USDC (6 decimals)
   * @example { isRuntime: true, inputParams: [], outputParams: [] }
   */
  amount: bigint | RuntimeValue
}

/**
 * Base parameters for building instructions
 * @property account address - EOA wallet or owner account address
 * @property currentInstructions - {@link Instruction[]} Optional array of existing instructions to append to
 */
export type BaseInstructionsParams = {
  accountAddress: Address
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
  efficientMode?: false // non composable currently => no need to compress
}

/**
 * Trigger build action which is used to build instructions for triggering a transfer
 * @property type - Literal "trigger" to identify the action type
 * @property data - {@link BuildTransferFromParameters} The parameters for the trigger action
 */
export type BuildTransferFromInstruction = {
  type: "transferFrom"
  data: BuildTransferFromParameters
  efficientMode?: boolean
}

/**
 * Build action which is used to build instructions for a transfer
 * @property type - Literal "transfer" to identify the action type
 * @property data - {@link BuildTransferParameters} The parameters for the transfer action
 */
export type BuildTransferInstruction = {
  type: "transfer"
  data: BuildTransferParameters
  efficientMode?: boolean
}

/**
 * Build action which is used to build instructions for a value transfer
 * @property type - Literal "nativeTokenTransfer" to identify the action type
 * @property data - {@link BuildNativeTokenTransferComposableParameters} The parameters for the value transfer action
 */
export type BuildNativeTokenTransferInstruction = {
  type: "nativeTokenTransfer"
  data: BuildNativeTokenTransferComposableParameters
  efficientMode?: boolean
}

/**
 * Build action which is used to build instructions for an approval
 * @property type - Literal "approve" to identify the action type
 * @property data - {@link BuildApproveParameters} The parameters for the approval action
 */
export type BuildApproveInstruction = {
  type: "approve"
  data: BuildApproveParameters
  efficientMode?: boolean
}

/**
 * Build action which is used to build instructions for a withdrawal
 * @property type - Literal "withdrawal" to identify the action type
 * @property data - {@link BuildWithdrawalParameters} The parameters for the withdrawal action
 */
export type BuildWithdrawalInstruction = {
  type: "withdrawal"
  data: BuildWithdrawalParameters
  efficientMode?: boolean
}

/**
 * Build action which is used to build instructions for a batch
 * @property type - Literal "batch" to identify the action type
 * @property data - {@link BuildBatchParameters} The parameters for the batch action
 */
export type BuildBatchInstruction = {
  type: "batch"
  data: BuildBatchParameters
  efficientMode?: false // not used for batch
}

/**
 * Build action which is used to build instructions for a composable call
 * @property type - Literal "composable" to identify the action type
 * @property data - {@link BuildComposableParameters} The parameters for the composable action
 */
export type BuildComposableInstruction = {
  type: "default"
  data: BuildComposableParameters
  efficientMode?: boolean
}

/**
 * Build composable action which is used to build instructions for a raw composable call
 * @property type - Literal "raw" to identify the action type
 * @property data - {@link BuildComposableParameters} The parameters for the raw composable action
 */
export type BuildComposableRawInstruction = {
  type: "rawCalldata"
  data: BuildRawComposableParameters
  efficientMode?: false // as raw calldata doesn't have to be compressed
}

/**
 * Build action which is used to build instructions for a across intent composable call
 * @property type - Literal "acrossIntent" to identify the action type
 * @property data - {@link BuildAcrossIntentComposableParameters} The parameters for the across intent composable action
 */
export type BuildAcrossIntentComposableInstruction = {
  type: "acrossIntent"
  data: BuildAcrossIntentComposableParams
  efficientMode?: false // as raw calldata doesn't have to be compressed
}

/**
 * Build action which is used to build instructions for uninstalling modules
 * @property type - Literal "buildMultichainInstructions" to identify the action type
 * @property data - {@link BuildMultichainInstructionParameters} The parameters for the uninstall modules action
 */
export type BuildMultichainInstructionInstruction = {
  type: "multichain"
  data: BuildMultichainInstructionsParameters
  efficientMode?: false // non composable currently => no need to compress
}

export type ComposabilityParams = {
  composabilityVersion: ComposabilityVersion
  forceComposableEncoding?: boolean
  efficientMode?: boolean
}

export type BaseInstructionTypes =
  | BuildTransferFromInstruction
  | BuildTransferInstruction
  | BuildApproveInstruction
  | BuildWithdrawalInstruction
  | BuildBatchInstruction

/**
 * Union type of all possible build instruction types
 */
export type BuildInstructionTypes =
  | BaseInstructionTypes
  | BuildDefaultInstruction
  | BuildMultichainInstructionInstruction
  | BuildIntentInstruction

/**
 * Union type of all possible build composable instruction types
 */
export type BuildComposableInstructionTypes =
  | BaseInstructionTypes
  | BuildNativeTokenTransferInstruction
  | BuildComposableInstruction
  | BuildComposableRawInstruction
  | BuildAcrossIntentComposableInstruction

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
 *   { accountAddres: mcNexus.signer.address },
 *   {
 *     type: "intent",
 *     data: {
 *       depositor: mcNexus.addressOn(paymentChain.id, true),
 *       recipient: mcNexus.addressOn(targetChain.id, true),
 *       amount: 1n,
 *       token: {
 *         mcToken: mcUSDC,
 *         unifiedBalance: await mcNexus.getUnifiedERC20Balance(mcUSDC)
 *       },
 *       toChainId: targetChain.id
 *     }
 *   }
 * );
 *
 * @example
 * // Default action example
 * const defaultInstructions = await build(
 *   { accountAddress: "0x00000000000000000000000000000000000a11ce" },
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

  const containsRuntimeValues = Object.values(data).some((value) =>
    isRuntimeComposableValue(value)
  )
  if (containsRuntimeValues) {
    throw new Error(
      "Runtime values are not supported for `build` action. Use `buildComposable` instead."
    )
  }

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
    case "multichain": {
      return buildMultichainInstructions(baseParams, data)
    }
    default: {
      throw new Error(`Unknown build action type: ${type}`)
    }
  }
}

// Exactly same as build decorator, but forces to use composable call.
// If this is used via mcNexus.buildComposable, then the composabilityVersion is auto-detected for all the required cases.
export const buildComposable = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildComposableInstructionTypes,
  composabilityVersion?: ComposabilityVersion
): Promise<Instruction[]> => {
  const { type, data, efficientMode } = parameters

  // in batch mode only, we do not need to specify the composability version
  if (type !== "batch" && !composabilityVersion) {
    throw new Error(
      `Composability version param is required for composable type: ${type}`
    )
  }
  // so here and below we are sure, that composabilityVersion is defined

  switch (type) {
    case "default": {
      return buildComposableUtil(baseParams, data, {
        composabilityVersion: composabilityVersion!,
        efficientMode
      })
    }
    case "rawCalldata": {
      return buildRawComposable(baseParams, data, {
        composabilityVersion: composabilityVersion!
      })
    }
    case "transferFrom": {
      return buildTransferFrom(baseParams, data, {
        forceComposableEncoding: true,
        efficientMode,
        composabilityVersion: composabilityVersion!
      })
    }
    case "transfer": {
      return buildTransfer(baseParams, data, {
        forceComposableEncoding: true,
        efficientMode,
        composabilityVersion: composabilityVersion!
      })
    }
    case "nativeTokenTransfer": {
      return buildRawComposable(
        baseParams,
        {
          ...data,
          calldata: "0x00000000"
        },
        {
          composabilityVersion: composabilityVersion!
        }
      )
    }
    case "approve": {
      return buildApprove(baseParams, data, {
        forceComposableEncoding: true,
        efficientMode,
        composabilityVersion: composabilityVersion!
      })
    }
    case "withdrawal": {
      return buildWithdrawal(baseParams, data, {
        forceComposableEncoding: true,
        efficientMode,
        composabilityVersion: composabilityVersion!
      })
    }
    case "batch": {
      return buildBatch(baseParams, data)
    }
    case "acrossIntent": {
      return buildAcrossIntentComposable(baseParams, data, {
        composabilityVersion: composabilityVersion!,
        efficientMode: false, // nothing to group in this case
        forceComposableEncoding: true // both subactions are composable
      })
    }
    default: {
      throw new Error(`Unknown build action type: ${type}`)
    }
  }
}

export default build
