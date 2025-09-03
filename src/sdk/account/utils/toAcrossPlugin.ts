import { type Address, parseAbi } from "abitype"

import { encodeFunctionData, erc20Abi } from "viem"
import {
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
  sepolia
} from "viem/chains"
import { createHttpClient } from "../../clients/createHttpClient"
import type {
  AbstractCall,
  Instruction
} from "../../clients/decorators/mee/getQuote"
import type {
  BridgingPlugin,
  BridgingPluginResult,
  BridgingUserOpParams
} from "../decorators/buildBridgeInstructions"

/**
 * Response type for Across bridge relay fee information
 * @interface AcrossRelayFeeResponse
 */
export interface AcrossRelayFeeResponse {
  totalRelayFee: {
    pct: string
    total: string
  }
  relayerCapitalFee: {
    pct: string
    total: string
  }
  relayerGasFee: {
    pct: string
    total: string
  }
  lpFee: {
    pct: string
    total: string
  }
  timestamp: string
  isAmountTooLow: boolean
  quoteBlock: string
  spokePoolAddress: Address
  exclusiveRelayer: Address
  exclusivityDeadline: string
}

/**
 * Parameters for fetching suggested fees from Across bridge
 * @typedef AcrossSuggestedFeesParams
 * @property {Address} inputToken - Source token address
 * @property {Address} outputToken - Destination token address
 * @property {number} originChainId - Source chain ID
 * @property {number} destinationChainId - Destination chain ID
 * @property {bigint} amount - Amount to bridge
 */
type AcrossSuggestedFeesParams = {
  inputToken: Address
  outputToken: Address
  originChainId: number
  destinationChainId: number
  amount: bigint
}

const TESTNET_IDS: number[] = [
  sepolia.id,
  baseSepolia.id,
  optimismSepolia.id,
  arbitrumSepolia.id
]

// Create HTTP client instance
const acrossClient = createHttpClient("https://app.across.to/api")
const testnetAcrossClient = createHttpClient("https://testnet.across.to/api")

/**
 * Fetches suggested fees from Across bridge API
 * @param {AcrossSuggestedFeesParams} params - Parameters for fee calculation
 * @param {Address} params.inputToken - Source token address
 * @param {Address} params.outputToken - Destination token address
 * @param {number} params.originChainId - Source chain ID
 * @param {number} params.destinationChainId - Destination chain ID
 * @param {bigint} params.amount - Amount to bridge
 * @returns {Promise<AcrossRelayFeeResponse>} Suggested fees and related information
 */
const acrossGetSuggestedFees = async ({
  inputToken,
  outputToken,
  originChainId,
  destinationChainId,
  amount
}: AcrossSuggestedFeesParams): Promise<AcrossRelayFeeResponse> => {
  const client = TESTNET_IDS.includes(originChainId)
    ? testnetAcrossClient
    : acrossClient

  return client.request<AcrossRelayFeeResponse>({
    path: "suggested-fees",
    method: "GET",
    params: {
      inputToken,
      outputToken,
      originChainId: originChainId.toString(),
      destinationChainId: destinationChainId.toString(),
      amount: amount.toString()
    }
  })
}

/**
 * Encodes a bridging operation for the Across protocol into a user operation
 * @param {BridgingUserOpParams} params - Parameters for the bridge operation
 * @param {bigint} params.bridgingAmount - Amount to bridge
 * @param {number} params.fromChainId - Source chain ID
 * @param {Address} params.depositor - Depositor address
 * @param {Address} params.recipient - Recipient address
 * @param {number} params.toChainId - Destination chain ID
 * @param {TokenMapping} params.tokenMapping - Token address mapping across chains
 * @returns {Promise<BridgingPluginResult>} Encoded user operation and bridging details
 * @throws {Error} When depositor or recipient address cannot be found
 */
export const acrossEncodeBridgingUserOp = async (
  params: BridgingUserOpParams
): Promise<BridgingPluginResult> => {
  const {
    bridgingAmount,
    fromChainId,
    depositor,
    recipient,
    toChainId,
    tokenMapping
  } = params

  const inputToken = tokenMapping.on(fromChainId)
  const outputToken = tokenMapping.on(toChainId)

  const suggestedFees = await acrossGetSuggestedFees({
    amount: bridgingAmount,
    destinationChainId: toChainId,
    inputToken: inputToken,
    outputToken: outputToken,
    originChainId: fromChainId
  })

  const depositV3abi = parseAbi([
    "function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes message) external"
  ])

  const outputAmount =
    BigInt(bridgingAmount) - BigInt(suggestedFees.totalRelayFee.total)

  const fillDeadlineBuffer = 18000
  const fillDeadline = Math.round(Date.now() / 1000) + fillDeadlineBuffer

  const approveCall: AbstractCall = {
    to: inputToken,
    gasLimit: 100000n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [suggestedFees.spokePoolAddress, bridgingAmount]
    })
  }

  const depositCall: AbstractCall = {
    to: suggestedFees.spokePoolAddress,
    gasLimit: 1500n,
    data: encodeFunctionData({
      abi: depositV3abi,
      args: [
        depositor,
        recipient,
        inputToken,
        outputToken,
        bridgingAmount,
        outputAmount,
        BigInt(toChainId),
        suggestedFees.exclusiveRelayer,
        Number.parseInt(suggestedFees.timestamp),
        fillDeadline,
        Number.parseInt(suggestedFees.exclusivityDeadline),
        "0x" // message
      ]
    })
  }

  const userOp: Instruction = {
    calls: [approveCall, depositCall],
    chainId: fromChainId
  }

  return {
    userOp,
    receivedAtDestination: outputAmount,
    bridgingDurationExpectedMs: undefined
  }
}

/**
 * Creates an Across bridging plugin instance
 * @returns {BridgingPlugin} Plugin instance implementing the Across bridge protocol
 *
 * @example
 * const acrossPlugin = toAcrossPlugin()
 * const bridgeResult = await acrossPlugin.encodeBridgeUserOp({
 *   bridgingAmount: 1000000n,
 *   fromChainId: 11155111,
 *   toChainId: 84532,
 *   depositor: "0x00000000000000000000000000000000000a11ce",
 *   recipient: "0x00000000000000000000000000000000000a11ce",
 *   tokenMapping: tokens
 * })
 */
export const toAcrossPlugin = (): BridgingPlugin => ({
  encodeBridgeUserOp: async (params) => {
    return await acrossEncodeBridgingUserOp(params)
  }
})
