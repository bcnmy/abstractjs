import type { Address } from "viem"
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import { toAcrossPlugin } from "../utils/toAcrossPlugin"
import type { UnifiedERC20Balance } from "./getUnifiedERC20Balance"
import type { BridgeQueryResult } from "./queryBridge"
import { queryBridge } from "./queryBridge"

/**
 * Mapping of a token address to a specific chain
 * @property chainId - The numeric ID of the chain
 * @property address - {@link Address} The token's contract address on the chain
 */
export type AddressMapping = {
  chainId: number
  address: Address
}

/**
 * Cross-chain token address mapping with helper functions
 * @property deployments - Array of {@link AddressMapping} containing token addresses per chain
 * @property on - Function to retrieve token address for a specific chain ID
 */
export type MultichainAddressMapping = {
  deployments: AddressMapping[]
  on: (chainId: number) => Address
}

/**
 * Fee data for the transaction fee
 * @property txFeeChainId - The chain ID where the tx fee is paid
 * @property txFeeAmount - The amount of tx fee to pay
 */
export type FeeData = {
  txFeeChainId: number
  txFeeAmount: bigint
}

/**
 * Parameters for multichain token bridging operations
 * @property depositor - {@link Address} The address initiating the bridge (sender)
 * @property recipient - {@link Address} The address receiving the bridged tokens (destination)
 * @property toChainId - The numeric chain ID of the destination chain
 * @property unifiedBalance - {@link UnifiedERC20Balance} Token balance information across all chains
 * @property amount - Amount of tokens to bridge as bigint
 * @property bridgingPlugins - Optional array of {@link BridgingPlugin} to use for bridging
 * @property feeData - Optional {@link FeeData} for the transaction
 * @property mode - Optional bridging mode, either "DEBIT" or "OPTIMISTIC"
 */
export type MultichainBridgingParams = {
  depositor: Address
  recipient: Address
  toChainId: number
  unifiedBalance: UnifiedERC20Balance
  amount: bigint
  bridgingPlugins?: BridgingPlugin[]
  feeData?: FeeData
  mode?: "DEBIT" | "OPTIMISTIC"
}

/**
 * Result of a bridging plugin operation
 * @property userOp - {@link Instruction} User operation to execute the bridge
 * @property receivedAtDestination - Expected amount to be received after bridging
 * @property bridgingDurationExpectedMs - Expected duration of the bridging operation
 */
export type BridgingPluginResult = {
  userOp: Instruction
  receivedAtDestination?: bigint
  bridgingDurationExpectedMs?: number
}

/**
 * Parameters for generating a bridge user operation
 * @property depositor - {@link Address} The address initiating the bridge (sender)
 * @property recipient - {@link Address} The address receiving the bridged tokens (destination)
 * @property fromChainId - The numeric chain ID of the source chain
 * @property toChainId - The numeric chain ID of the destination chain
 * @property tokenMapping - {@link MultichainAddressMapping} Token addresses across chains
 * @property bridgingAmount - Amount to bridge as BigInt
 */
export type BridgingUserOpParams = {
  depositor: Address
  recipient: Address
  fromChainId: number
  toChainId: number
  tokenMapping: MultichainAddressMapping
  bridgingAmount: bigint
}

/**
 * Interface for a bridging plugin implementation
 */
export type BridgingPlugin = {
  /** Generates a user operation for bridging tokens */
  encodeBridgeUserOp: (
    params: BridgingUserOpParams
  ) => Promise<BridgingPluginResult>
}

/**
 * Single bridge operation result
 * @property userOp - {@link Instruction} User operation to execute
 * @property receivedAtDestination - Expected amount to be received at destination
 * @property bridgingDurationExpectedMs - Expected duration of the bridging operation
 */
export type BridgingInstruction = {
  userOp: Instruction
  receivedAtDestination?: bigint
  bridgingDurationExpectedMs?: number
}

/**
 * Complete set of bridging instructions and final outcome
 * @property instructions - Array of {@link Instruction} to execute
 * @property meta - Meta information about the bridging process
 */
export type BridgingInstructions = {
  instructions: Instruction[]
  meta: {
    totalAvailableOnDestination: bigint
    bridgingInstructions: BridgingInstruction[]
  }
}

/**
 * Makes sure that the user has enough funds on the selected chain before filling the
 * supertransaction. Bridges funds from other chains if needed.
 *
 * @param params - {@link MultichainBridgingParams} Configuration for the bridge operation
 * @param params.depositor - The address initiating the bridge (sender)
 * @param params.recipient - The address receiving the bridged tokens (destination)
 * @param params.toChainId - The numeric chain ID of the destination chain
 * @param params.unifiedBalance - Current token balances across chains
 * @param params.amount - The amount to bridge
 * @param params.bridgingPlugins - Optional array of bridging plugins (defaults to Across)
 * @param params.feeData - Optional fee configuration
 * @param params.mode - The mode of the bridge operation, defaults to "DEBIT". In optimistic mode, the bridging instructions are returned without preexisting balance checks.
 *
 * @returns Promise resolving to {@link BridgingInstructions} containing all necessary operations
 *
 * @throws Error if insufficient balance is available for bridging
 * @throws Error if chain configuration is missing for any deployment
 *
 * @example
 * const bridgeInstructions = await buildBridgeInstructions({
 *   depositor: myAddress,
 *   recipient: recipientAddress,
 *   amount: BigInt("1000000"), // 1 USDC
 *   toChainId: optimism.id,
 *   unifiedBalance: myTokenBalance,
 *   bridgingPlugins: [acrossPlugin],
 *   feeData: {
 *     txFeeChainId: 1,
 *     txFeeAmount: BigInt("100000")
 *   }
 * });
 */
export const buildBridgeInstructions = async (
  params: MultichainBridgingParams
): Promise<BridgingInstructions> => {
  const {
    depositor,
    recipient,
    amount: targetAmount,
    toChainId,
    unifiedBalance,
    bridgingPlugins = [toAcrossPlugin()],
    feeData,
    mode = "DEBIT"
  } = params

  const tokenMapping = {
    on: (chainId: number) =>
      unifiedBalance.mcToken.deployments.get(chainId) || "0x",
    deployments: Array.from(
      unifiedBalance.mcToken.deployments.entries(),
      ([chainId, address]) => ({
        chainId,
        address
      })
    )
  }

  // Get current balance on destination chain
  const destinationBalance =
    unifiedBalance.breakdown.find((b) => b.chainId === toChainId)?.balance || 0n

  // If we have enough on destination, no bridging needed
  if (destinationBalance >= targetAmount) {
    return {
      instructions: [],
      meta: {
        bridgingInstructions: [],
        totalAvailableOnDestination: destinationBalance
      }
    }
  }

  // Calculate how much we need to bridge
  const amountToBridge = targetAmount - destinationBalance

  // Get available balances from source chains
  const sourceBalances = unifiedBalance.breakdown
    .filter((balance) => balance.chainId !== toChainId)
    .map((balance_) => {
      // If we are in optimistic mode, we need to retrieve instructions for the bridging action regardless of the balance
      const balancePerChain =
        mode === "DEBIT" ? balance_ : { ...balance_, balance: targetAmount }

      // If this is the fee payment chain, adjust available balance
      const isFeeChain =
        feeData && feeData.txFeeChainId === balancePerChain.chainId

      const availableBalance =
        isFeeChain && "txFeeAmount" in feeData
          ? balancePerChain.balance > feeData.txFeeAmount
            ? balancePerChain.balance - feeData.txFeeAmount
            : 0n
          : balancePerChain.balance

      return {
        chainId: balancePerChain.chainId,
        balance: availableBalance
      }
    })
    .filter((balance) => balance.balance > 0n)

  // Query all possible routes
  const bridgeQueries = sourceBalances.flatMap((source) => {
    return bridgingPlugins.map((plugin) =>
      queryBridge({
        depositor,
        recipient,
        fromChainId: source.chainId,
        toChainId,
        plugin,
        amount: source.balance,
        tokenMapping
      })
    )
  })

  const bridgeResults = (await Promise.all(bridgeQueries))
    .filter((result): result is BridgeQueryResult => result !== null)
    // Sort by received amount relative to sent amount
    .sort(
      (a, b) =>
        Number((b.receivedAtDestination * 10000n) / b.amount) -
        Number((a.receivedAtDestination * 10000n) / a.amount)
    )

  // Build instructions by taking from best routes until we have enough
  const { bridgingInstructions, instructions, totalBridged, remainingNeeded } =
    bridgeResults.reduce(
      (acc, result) => {
        if (acc.remainingNeeded <= 0n) return acc

        const amountToTake =
          result.amount >= acc.remainingNeeded
            ? acc.remainingNeeded
            : result.amount

        const receivedFromRoute =
          (result.receivedAtDestination * amountToTake) / result.amount

        return {
          bridgingInstructions: [
            ...acc.bridgingInstructions,
            {
              userOp: result.userOp,
              receivedAtDestination: receivedFromRoute,
              bridgingDurationExpectedMs: result.bridgingDurationExpectedMs
            }
          ],
          instructions: [...acc.instructions, result.userOp],
          totalBridged: acc.totalBridged + receivedFromRoute,
          remainingNeeded: acc.remainingNeeded - amountToTake
        }
      },
      {
        bridgingInstructions: [] as BridgingInstruction[],
        instructions: [] as Instruction[],
        totalBridged: 0n,
        remainingNeeded: amountToBridge
      }
    )

  // Check if we got enough
  if (remainingNeeded > 0n) {
    throw new Error(
      `Insufficient balance for bridging:
         Required: ${targetAmount.toString()}
         Available to bridge: ${totalBridged.toString()}
         Shortfall: ${remainingNeeded.toString()}`
    )
  }

  return {
    instructions,
    meta: {
      bridgingInstructions,
      totalAvailableOnDestination: destinationBalance + totalBridged
    }
  }
}

export default buildBridgeInstructions
