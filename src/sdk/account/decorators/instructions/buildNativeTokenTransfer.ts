/**
 * Builds an instruction for transferring native tokens (e.g., ETH) from a smart contract account (SCA)
 * to a recipient address. This function supports both static and runtime-composable parameters,
 *
 * If any of the parameters (`to` or `value`) are runtime-composable, or if `forceComposableEncoding`
 * is set, the instruction will be encoded as a composable call using runtime encoding.
 * Otherwise, a standard instruction is created.
 *
 * @module buildNativeTokenTransfer
 */

import { type Address, zeroAddress } from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import type { InstructionMetadata } from "../../../clients/decorators/mee/types/instruction-metadata.type"
import { type RuntimeValue, isRuntimeComposableValue } from "../../../modules"
import type { BaseInstructionsParams, ComposabilityParams } from "../build"
import buildRawComposable from "./buildRawComposable"

/**
 * Parameters for building a native token transfer instruction.
 *
 * @property to - The recipient address or a runtime value (for composable calls)
 * @property gasLimit - Optional gas limit for the transfer
 * @property value - Amount of native token to transfer (in wei or as a runtime value)
 * @property chainId - The chain ID where the transfer will be executed
 * @property metadata - Optional custom metadata override for the instruction
 */
export type BuildNativeTokenTransferParameters = {
  to: Address | RuntimeValue
  gasLimit?: bigint
  value: bigint | RuntimeValue
  chainId: number
  metadata?: InstructionMetadata[]
}

/**
 * Builds an instruction for transferring native tokens (e.g., ETH) from the account to a recipient.
 *
 * @param baseParams - Base configuration for the instruction (account address, current instructions)
 * @param parameters - Parameters for the native token transfer
 * @param composabilityParams - Optional composability configuration (version, force encoding, etc.)
 * @returns Promise resolving to an array of {@link Instruction}
 *
 * @example
 * // Static transfer
 * const instructions = await buildNativeTokenTransfer(
 *   { accountAddress: myAccount.address },
 *   { to: recipient, value: 1_000_000_000_000_000_000n, chainId: 1 }
 * )
 *
 * @example
 * // Composable transfer with runtime value
 * const instructions = await buildNativeTokenTransfer(
 *   { accountAddress: myAccount.address },
 *   { to: { isRuntime: true, ... }, value: { isRuntime: true, ... }, chainId: 1 },
 *   { composabilityVersion: 2 }
 * )
 */
export const buildNativeTokenTransfer = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildNativeTokenTransferParameters,
  composabilityParams?: ComposabilityParams
): Promise<Instruction[]> => {
  const { currentInstructions = [], accountAddress } = baseParams
  const {
    chainId,
    value,
    gasLimit,
    to,
    metadata: metadataOverride
  } = parameters
  const { forceComposableEncoding, composabilityVersion } =
    composabilityParams ?? {
      forceComposableEncoding: false
    }

  // Detect if any parameter is a runtime-composable value
  const isComposableValueFound = [value, to].some((val) =>
    isRuntimeComposableValue(val)
  )

  // Determine if the call should be encoded as composable
  const isComposableCall = forceComposableEncoding
    ? true
    : isComposableValueFound

  let instructions: Instruction[]

  if (isComposableCall) {
    // Composable call: requires composability version and runtime encoding
    if (!composabilityVersion) {
      throw new Error(
        "Composability version is required to build native token transfer instruction"
      )
    }

    // Compose metadata for the instruction, using RUNTIME_VALUE placeholders if needed
    const metadata: InstructionMetadata[] = [
      {
        type: "TRANSFER",
        tokenAddress: zeroAddress,
        fromAddress: accountAddress,
        toAddress: isRuntimeComposableValue(to)
          ? "RUNTIME_VALUE"
          : (to as Address),
        amount: isRuntimeComposableValue(value)
          ? "RUNTIME_VALUE"
          : (value as bigint),
        chainId: chainId
      }
    ]

    // Use buildRawComposable to create the composable instruction
    instructions = await buildRawComposable(
      baseParams,
      {
        to,
        value,
        chainId,
        gasLimit,
        calldata: "0x00000000", // Zero function sig to transfer ETH from SCA to recipient
        metadata: metadataOverride || metadata
      },
      {
        composabilityVersion: composabilityVersion
      }
    )
  } else {
    // Standard (non-composable) native token transfer
    const metadata: InstructionMetadata[] = [
      {
        type: "TRANSFER",
        tokenAddress: zeroAddress,
        fromAddress: accountAddress,
        toAddress: to as Address,
        amount: value as bigint,
        chainId: chainId
      }
    ]

    instructions = [
      {
        calls: [
          {
            to: to as Address,
            value: value as bigint,
            data: "0x" // No calldata for native token transfer
          }
        ],
        metadata: metadataOverride || metadata,
        isComposable: false,
        chainId
      }
    ]
  }

  // Return the new instructions appended to any existing ones
  return [...currentInstructions, ...instructions]
}

export default buildNativeTokenTransfer
