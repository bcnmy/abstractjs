import { type Address, parseAbi } from "abitype"

import { encodeFunctionData, erc20Abi } from "viem"
import type {
  BridgingPlugin,
  BridgingPluginResult,
  BridgingUserOpParams
} from "../utils/syntax/bridging-builder"
import type { AbstractCall, Instruction } from "../decorators/getQuote"

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

type AcrossSuggestedFeesParams = {
  inputToken: Address
  outputToken: Address
  originChainId: number
  destinationChainId: number
  amount: bigint
}

const ACROSS_API_BASE_URL = "https://app.across.to/api"

const acrossGetSuggestedFees = async ({
  inputToken,
  outputToken,
  originChainId,
  destinationChainId,
  amount
}: AcrossSuggestedFeesParams): Promise<AcrossRelayFeeResponse> => {
  const url = new URL(`${ACROSS_API_BASE_URL}/suggested-fees`)

  const params = new URLSearchParams({
    inputToken,
    outputToken,
    originChainId: originChainId.toString(),
    destinationChainId: destinationChainId.toString(),
    amount: amount.toString()
  })

  url.search = params.toString()

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    return data
  } catch (error) {
    throw new Error(
      `Failed to fetch suggested fees from Across: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
  }
}

export const acrossEncodeBridgingUserOp = async (
  params: BridgingUserOpParams
): Promise<BridgingPluginResult> => {
  const {
    bridgingAmount,
    fromChain,
    multichainAccount,
    toChain,
    tokenMapping
  } = params

  const inputToken = tokenMapping.on(fromChain.id)
  const outputToken = tokenMapping.on(toChain.id)
  const depositor = multichainAccount.deploymentOn(fromChain.id).address
  const recipient = multichainAccount.deploymentOn(toChain.id).address

  const suggestedFees = await acrossGetSuggestedFees({
    amount: bridgingAmount,
    destinationChainId: toChain.id,
    inputToken: inputToken,
    outputToken: outputToken,
    originChainId: fromChain.id
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
    gasLimit: 150000n,
    data: encodeFunctionData({
      abi: depositV3abi,
      args: [
        depositor,
        recipient,
        inputToken,
        outputToken,
        bridgingAmount,
        outputAmount,
        BigInt(toChain.id),
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
    chainId: fromChain.id
  }

  return {
    userOp: userOp,
    receivedAtDestination: outputAmount,
    bridgingDurationExpectedMs: undefined
  }
}

export const AcrossPlugin: BridgingPlugin = {
  encodeBridgeUserOp: async (params) => {
    return await acrossEncodeBridgingUserOp(params)
  }
}
