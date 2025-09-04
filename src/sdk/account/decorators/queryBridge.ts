import type { Address } from "viem"
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import { toAcrossPlugin } from "../utils/toAcrossPlugin"
import type {
  BridgingPlugin,
  MultichainAddressMapping
} from "./buildBridgeInstructions"

/**
 * Parameters for querying bridge operations
 * @property depositor - {@link Address} Account address of the source chain
 * @property recipient - {@link Address} Account address of the destination chain
 * @property fromChainId - Source chain id for the bridge operation
 * @property toChainId - Destination chain id for the bridge operation
 * @property plugin - Optional {@link BridgingPlugin} implementation (defaults to Across)
 * @property amount - Amount to bridge in base units (wei) as BigInt
 * @property tokenMapping - {@link MultichainAddressMapping} Token addresses across chains
 */
export type QueryBridgeParams = {
  /** Account address of the source chain */
  depositor: Address
  /** Account address of the destination chain */
  recipient: Address
  /** Source chain id for the bridge operation */
  fromChainId: number
  /** Destination chain id for the bridge operation */
  toChainId: number
  /** Optional plugin implementation for the bridging operation */
  plugin?: BridgingPlugin
  /** Amount to bridge in base units (wei) */
  amount: bigint
  /** Mapping of token addresses across chains */
  tokenMapping: MultichainAddressMapping
}

/**
 * Result of a bridge query including chain info
 * @property fromChainId - ID of the source chain
 * @property amount - Amount to bridge in base units (wei) as BigInt
 * @property receivedAtDestination - Expected amount to receive at destination after fees
 * @property plugin - {@link BridgingPlugin} Plugin implementation used for the bridging operation
 * @property userOp - {@link Instruction} Resolved user operation for the bridge
 * @property bridgingDurationExpectedMs - Optional expected duration of the bridging operation in milliseconds
 */
export type BridgeQueryResult = {
  /** ID of the source chain */
  fromChainId: number
  /** Amount to bridge in base units (wei) */
  amount: bigint
  /** Expected amount to receive at destination after fees */
  receivedAtDestination: bigint
  /** Plugin implementation used for the bridging operation */
  plugin: BridgingPlugin
  /** Resolved user operation for the bridge */
  userOp: Instruction
  /** Expected duration of the bridging operation in milliseconds */
  bridgingDurationExpectedMs?: number
}

/**
 * Queries a bridge operation to determine expected outcomes and fees
 *
 * @param params - {@link QueryBridgeParams} Configuration for the bridge query
 * @param params.depositor - Account address of the source chain
 * @param params.recipient - Account address of the destination chain
 * @param params.fromChainId - Source chain id for the bridge operation
 * @param params.toChainId - Destination chain id for the bridge operation
 * @param params.plugin - Optional bridging plugin (defaults to Across)
 * @param params.amount - Amount to bridge in base units (wei)
 * @param params.tokenMapping - Token addresses across chains
 *
 * @returns Promise resolving to {@link BridgeQueryResult} or null if received amount cannot be determined
 *
 * @throws Error if bridge plugin does not return a received amount
 *
 * @example
 * const result = await queryBridge({
 *   depositor: "0xabc...",
 *   recipient: "0xdef...",
 *   fromChainId: 10,
 *   toChainId: 8453,
 *   amount: BigInt("1000000"), // 1 USDC
 *   tokenMapping: {
 *     deployments: [
 *       { chainId: 10, address: "0x123..." },
 *       { chainId: 8453, address: "0x456..." }
 *     ],
 *     on: (chainId) => deployments.find(d => d.chainId === chainId).address
 *   }
 * });
 *
 * if (result) {
 *   console.log(`Expected to receive: ${result.receivedAtDestination}`);
 *   console.log(`Expected duration: ${result.bridgingDurationExpectedMs}ms`);
 * }
 */
export const queryBridge = async (
  params: QueryBridgeParams
): Promise<BridgeQueryResult | null> => {
  const {
    depositor,
    recipient,
    fromChainId,
    toChainId,
    plugin = toAcrossPlugin(),
    amount,
    tokenMapping
  } = params

  const result = await plugin.encodeBridgeUserOp({
    depositor,
    recipient,
    fromChainId,
    toChainId,
    tokenMapping,
    bridgingAmount: amount
  })

  // Skip if bridge doesn't provide received amount
  if (!result.receivedAtDestination) return null

  return {
    fromChainId: fromChainId,
    amount,
    receivedAtDestination: result.receivedAtDestination,
    plugin,
    userOp: result.userOp,
    bridgingDurationExpectedMs: result.bridgingDurationExpectedMs
  }
}
