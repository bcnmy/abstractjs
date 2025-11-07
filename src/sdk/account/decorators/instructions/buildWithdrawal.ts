import { type Address, encodeFunctionData } from "viem"
import type { AbstractCall, Instruction } from "../../../clients/decorators/mee"
import type { InstructionMetadata } from "../../../clients/decorators/mee/types/instruction-metadata.type"
import { ComposabilityVersion, ForwarderAbi } from "../../../constants"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { AnyData } from "../../../modules/utils/Types"
import {
  type ComposableCall,
  isComposableCallRequired,
  isRuntimeComposableValue
} from "../../../modules/utils/composabilityCalls"
import {
  type RuntimeValue,
  getFunctionContextFromAbi
} from "../../../modules/utils/runtimeAbiEncoding"
import { isNativeToken } from "../../utils"
import type {
  BaseInstructionsParams,
  ComposabilityParams,
  TokenParams
} from "../build"
import buildComposable, {
  type BuildComposableParameters,
  buildComposableCall
} from "./buildComposable"

/**
 * Parameters for building a transfer instruction
 */
export type BuildWithdrawalParameters = TokenParams & {
  /**
   * Gas limit for the transfer transaction. Required when using the standard
   * transfer function instead of permit.
   * @example 65000n
   */
  gasLimit?: bigint
  /**
   * Recipient address. Defaults to the account's signer address.
   * Is not injectable in case of withdrawals.
   * @example "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
   */
  recipient?: Address
  /** Custom metadata override for instruction */
  metadata?: InstructionMetadata[]
}

/**
 * Parameters for the buildWithdrawal function
 */
export type BuildWithdrawalParams = BaseInstructionsParams & {
  /**
   * Parameters specific to the transfer instruction
   * @see {@link BuildWithdrawalParameters}
   */
  parameters: BuildWithdrawalParameters
}

/**
 * Builds an instruction for transferring tokens. This function creates the necessary
 * instruction for a standard ERC20 transfer.
 *
 * @param baseParams - Base configuration for the instruction
 * @param baseParams.account - The account that will execute the transfer
 * @param baseParams.currentInstructions - Optional array of existing instructions to append to
 * @param parameters - Parameters for the transfer
 * @param parameters.chainId - Chain ID where the transfer will be executed
 * @param parameters.tokenAddress - Address of the token to transfer
 * @param parameters.amount - Amount to transfer
 * @param [parameters.gasLimit] - Optional gas limit for the transfer
 * @param [parameters.recipient] - Optional recipient address
 *
 * @returns Promise resolving to array of instructions
 *
 * @example
 * ```typescript
 * const instructions = await buildWithdrawal(
 *   { accountAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
 *   {
 *     chainId: 1,
 *     tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     amount: 1000000n, // 1 USDC
 *     gasLimit: 65000n,
 *     recipient: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *   }
 * );
 * ```
 */
export const buildWithdrawal = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildWithdrawalParameters,
  composabilityParams?: ComposabilityParams
): Promise<Instruction[]> => {
  const { currentInstructions = [], accountAddress, meeVersions } = baseParams

  const {
    chainId,
    tokenAddress,
    amount,
    gasLimit,
    recipient = accountAddress, // EOA or owner account address
    metadata: metadataOverride
  } = parameters

  const [meeVersionInfo] = meeVersions.filter(
    (meeVersion) => meeVersion.chainId === chainId
  )

  if (!meeVersionInfo) {
    throw new Error("MEE version is required to build a native token transfer")
  }

  const meeVersion = meeVersionInfo.version

  const { forceComposableEncoding = false } = composabilityParams ?? {
    forceComposableEncoding: false
  }

  const metadata: InstructionMetadata[] = metadataOverride || [
    {
      type: "WITHDRAW",
      tokenAddress: isRuntimeComposableValue(tokenAddress)
        ? "RUNTIME_VALUE"
        : (tokenAddress as Address),
      fromAddress: accountAddress,
      toAddress: recipient,
      amount: isRuntimeComposableValue(amount)
        ? "RUNTIME_VALUE"
        : (amount as bigint),
      chainId
    }
  ]

  let withdrawalCall: AbstractCall[] | ComposableCall[]

  if (isNativeToken(tokenAddress as Address)) {
    // native token withdrawal
    if (isRuntimeComposableValue(amount) || forceComposableEncoding) {
      // composable call
      if (!composabilityParams?.composabilityVersion) {
        throw new Error(
          "Composability version is required to build a call with the runtime injected param"
        )
      }
      const { composabilityVersion } = composabilityParams

      if (composabilityVersion === ComposabilityVersion.V1_0_0) {
        throw new Error(
          "Runtime values for Native tokens are not supported for Composability v1.0.0"
        )
      }

      // Uses buildComposable to build a native token transfer via eth forwarder
      return buildComposable(
        baseParams,
        {
          to: meeVersion.ethForwarderAddress,
          abi: ForwarderAbi,
          functionName: "forward",
          value: amount,
          gasLimit,
          args: [recipient],
          chainId,
          metadata: metadataOverride || metadata
        },
        composabilityParams
      )
    }

    // not composable call
    withdrawalCall = [
      {
        to: recipient,
        value: amount,
        ...(gasLimit ? { gasLimit } : {})
      } as AbstractCall
    ]
  } else {
    // ERC20 withdrawal
    const abi = TokenWithPermitAbi
    const functionSig = "transfer"
    const args: readonly [`0x${string}`, bigint | RuntimeValue] = [
      recipient,
      amount
    ]

    const functionContext = getFunctionContextFromAbi(functionSig, abi)

    // Check for the runtime arguments and detect the need for composable call
    const isComposableCall = forceComposableEncoding
      ? true
      : isComposableCallRequired(
          functionContext,
          args as unknown as Array<AnyData>
        )

    // If the composable call is detected ? The call needs to composed with runtime encoding
    if (isComposableCall) {
      // composable call
      if (!composabilityParams) {
        throw new Error(
          "Composability params are required to build a call with the runtime injected param"
        )
      }

      const composableCallParams: BuildComposableParameters = {
        to: tokenAddress,
        functionName: functionSig,
        args: args as unknown as Array<AnyData>,
        abi,
        chainId,
        ...(gasLimit ? { gasLimit } : {})
      }

      withdrawalCall = await buildComposableCall(
        composableCallParams,
        composabilityParams
      )

      return [
        ...currentInstructions,
        {
          calls: withdrawalCall,
          chainId,
          isComposable: true,
          metadata
        }
      ]
    }
    // not composable call
    withdrawalCall = [
      {
        to: tokenAddress,
        data: encodeFunctionData({
          abi,
          functionName: functionSig,
          args: args as [`0x${string}`, bigint]
        }),
        ...(gasLimit ? { gasLimit } : {})
      }
    ] as AbstractCall[]
  }

  // composable calls return early
  // so if we reach this point, it means that the call is not composable
  return [
    ...currentInstructions,
    {
      calls: withdrawalCall,
      chainId,
      metadata
    }
  ]
}

export default buildWithdrawal
