import {
  type Address,
  type Hex,
  concatHex,
  encodeFunctionData,
  formatUnits,
  getAddress,
  padHex,
  parseAbi,
  zeroAddress
} from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import { runtimeERC20BalanceOf } from "../../../modules/utils/composabilityCalls"
import type { BaseInstructionsParams } from "../build"
import { buildRawComposable } from "./buildRawComposable"
import buildTransfer from "./buildTransfer"
import { createChainAddressMap } from "../../../modules/utils/createChainAddressMap"
import { base, optimism } from "viem/chains"

const acrossIntentWrappers = createChainAddressMap([
  [Number(base.id), "0xB78dEafFE8448230b89f0979Ef861F453b3F1e02"],
  [Number(optimism.id), "0xfE86086f5B4731459cB43128e2Dba8248b90600E"]
])

// 🚀 Across SpokePool addresses
const acrossSpokePool = createChainAddressMap([
  [Number(base.id), "0x09aea4b2242abc8bb4bb78d537a67a245a7bec64"],
  [Number(optimism.id), "0x6f26Bf09B1C792e3228e5467807a900A503c0281"]
])

/**
 * Parameters for building a raw composable instruction
 */
export type BuildAcrossIntentComposableParams = {
  depositor: Address
  recipient: Address
  inputToken: Address
  outputToken: Address
  approximateExpectedInputAmount: bigint // approximate amount of deposited tokens.
  originChainId: number
  destinationChainId: number
  message?: Hex
  relayerAddress?: Address
  pool?: Address
  gasLimit?: bigint
}

/**
 * Builds an instruction for across
 */
export const buildAcrossIntentComposable = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildAcrossIntentComposableParams
): Promise<Instruction[]> => {
  const {
    depositor,
    recipient,
    inputToken,
    outputToken,
    originChainId,
    destinationChainId,
    message,
    relayerAddress,
    gasLimit,
    approximateExpectedInputAmount,
    pool = acrossSpokePool[originChainId]
  } = parameters

  // 1. Transfer from Nexus to Wrapper
  // It is required because Across SpokePool deposit functions
  // do transferFrom(msg.sender, address(this), amount)
  // so we need Wrapper to actually have this balance
  const transferFromNexusToWrapperInstruction = await buildTransfer(
    baseParams,
    {
      chainId: originChainId,
      tokenAddress: inputToken,
      amount: runtimeERC20BalanceOf({
        // transfers the entire balance
        targetAddress: depositor,
        tokenAddress: inputToken
      }),
      recipient: acrossIntentWrappers[originChainId]
    }
  )

  // 2. Deposit to Pool
  const fees = await getAcrossSuggestedFees({
    amount: approximateExpectedInputAmount,
    originChainId,
    inputToken,
    destinationChainId,
    outputToken
  })

  // Calculate output amount after fees
  const { outputAmount: approximateExpectedOutputAmount } = calculateAcrossFees(
    {
      fees,
      amount: approximateExpectedInputAmount
    }
  )

  const outputRatioPrecision = 10000n // 5 decimal places
  const outputRatio =
    (approximateExpectedOutputAmount * outputRatioPrecision) /
    approximateExpectedInputAmount

  console.log("outputRatio", outputRatio)

  // make a packed uint256 where the first (most significant) 16 bits are the output ratio
  // and the last 16 bits (least significant) are the output ratio precision
  const outputRatioPacked = concatHex([
    padHex(outputRatio.toString(16) as `0x${string}`, { size: 16 }),
    padHex(outputRatioPrecision.toString(16) as `0x${string}`, { size: 16 })
  ])

  // Define Across SpokePool WRAPPER ABI
  const acrossSpokePoolWrapperAbi = parseAbi([
    "function depositV3Composable(address pool, address depositor, address recipient, address inputToken, address outputToken, uint256 outputRatioPacked, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes calldata message) external payable"
  ])

  // Build the deposit transaction
  const transactionRequest = {
    to: pool,
    chainId: originChainId,
    data: encodeFunctionData({
      abi: acrossSpokePoolWrapperAbi,
      functionName: "depositV3Composable",
      args: [
        pool,
        depositor,
        recipient,
        inputToken,
        outputToken,
        BigInt(outputRatioPacked),
        BigInt(destinationChainId),
        relayerAddress ?? zeroAddress,
        Number(fees.timestamp),
        Number(fees.fillDeadline),
        0, // exclusivityDeadline
        message ?? "0x" // message
      ]
    })
  }

  const depositToPoolInstruction = await buildRawComposable(baseParams, {
    to: acrossIntentWrappers[originChainId],
    calldata: transactionRequest.data,
    chainId: originChainId,
    gasLimit
  })

  return [...transferFromNexusToWrapperInstruction, ...depositToPoolInstruction]
}

export default buildAcrossIntentComposable

/**
 * -------------------------------------------------------------
 *  Across Protocol Quote Service — typed with viem
 * -------------------------------------------------------------
 */

export type SuggestedFeesParameters = {
  inputToken: Address
  outputToken: Address
  originChainId: number
  destinationChainId: number
  amount: bigint
  depositor?: Address
  recipient?: Address
  message?: Hex
  relayerAddress?: Address
  referrer?: Address
}

export type Fee = {
  pct: bigint
  total: bigint
}

export type Limits = {
  minDeposit: bigint
  maxDeposit: bigint
  maxDepositInstant: bigint
  maxDepositShortDelay: bigint
  recommendedDepositInstant: bigint
}

export type SuggestedFeesReturnType = {
  totalRelayFee: Fee
  relayerCapitalFee: Fee
  relayerGasFee: Fee
  lpFee: Fee
  timestamp: bigint
  isAmountTooLow: boolean
  quoteBlock: bigint
  spokePoolAddress: Address
  fillDeadline: bigint
  limits: Limits
}

export type GetSuggestedFeesErrorType = Error

/**
 * Gets suggested fees for Across Protocol bridge transfer
 *
 * @example
 * const fees = await getAcrossSuggestedFees({
 *   inputToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
 *   outputToken: '0x4200000000000000000000000000000000000006',
 *   originChainId: 1,
 *   destinationChainId: 10,
 *   amount: parseEther('1')
 * })
 */
export async function getAcrossSuggestedFees(
  parameters: SuggestedFeesParameters
): Promise<SuggestedFeesReturnType> {
  const {
    inputToken,
    outputToken,
    originChainId,
    destinationChainId,
    amount,
    depositor,
    recipient,
    message,
    relayerAddress,
    referrer
  } = parameters

  const url = new URL("https://app.across.to/api/suggested-fees")

  // Validate and format addresses
  url.searchParams.append("inputToken", getAddress(inputToken))
  url.searchParams.append("outputToken", getAddress(outputToken))
  url.searchParams.append("originChainId", originChainId.toString())
  url.searchParams.append("destinationChainId", destinationChainId.toString())
  url.searchParams.append("amount", amount.toString())

  if (depositor) {
    url.searchParams.append("depositor", getAddress(depositor))
  }
  if (recipient) {
    url.searchParams.append("recipient", getAddress(recipient))
  }
  if (message) {
    url.searchParams.append("message", message)
  }
  if (relayerAddress) {
    url.searchParams.append("relayerAddress", getAddress(relayerAddress))
  }
  if (referrer) {
    url.searchParams.append("referrer", getAddress(referrer))
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  })

  if (!response.ok) {
    throw new Error(
      `HTTP error! status: ${response.status} with url: ${url.toString()}`
    )
  }

  const data = (await response.json()) as {
    totalRelayFee: { pct: string; total: string }
    relayerCapitalFee: { pct: string; total: string }
    relayerGasFee: { pct: string; total: string }
    lpFee: { pct: string; total: string }
    timestamp: string
    isAmountTooLow: boolean
    quoteBlock: string
    spokePoolAddress: string
    expectedFillTimeSec: string
    fillDeadline: string
    limits: {
      minDeposit: string
      maxDeposit: string
      maxDepositInstant: string
      maxDepositShortDelay: string
      recommendedDepositInstant: string
    }
  }

  // Parse response to bigint types
  return {
    totalRelayFee: {
      pct: BigInt(data.totalRelayFee.pct),
      total: BigInt(data.totalRelayFee.total)
    },
    relayerCapitalFee: {
      pct: BigInt(data.relayerCapitalFee.pct),
      total: BigInt(data.relayerCapitalFee.total)
    },
    relayerGasFee: {
      pct: BigInt(data.relayerGasFee.pct),
      total: BigInt(data.relayerGasFee.total)
    },
    lpFee: {
      pct: BigInt(data.lpFee.pct),
      total: BigInt(data.lpFee.total)
    },
    timestamp: BigInt(data.timestamp),
    isAmountTooLow: data.isAmountTooLow,
    quoteBlock: BigInt(data.quoteBlock),
    spokePoolAddress: getAddress(data.spokePoolAddress),
    fillDeadline: BigInt(data.fillDeadline),
    limits: {
      minDeposit: BigInt(data.limits.minDeposit),
      maxDeposit: BigInt(data.limits.maxDeposit),
      maxDepositInstant: BigInt(data.limits.maxDepositInstant),
      maxDepositShortDelay: BigInt(data.limits.maxDepositShortDelay),
      recommendedDepositInstant: BigInt(data.limits.recommendedDepositInstant)
    }
  }
}

/**
 * Calculates total fees from suggested fees response
 *
 * @example
 * const result = calculateAcrossFees({
 *   fees,
 *   amount: parseEther('1')
 * })
 *
 * console.log(result.totalFees) // 0.005n (example)
 * console.log(result.outputAmount) // 0.995n (example)
 */
export type CalculateAcrossFeesParameters = {
  fees: SuggestedFeesReturnType
  amount: bigint
}

export type CalculateAcrossFeesReturnType = {
  totalFees: bigint
  relayerFees: bigint
  lpFees: bigint
  outputAmount: bigint
}

export function calculateAcrossFees(
  parameters: CalculateAcrossFeesParameters
): CalculateAcrossFeesReturnType {
  const { fees, amount } = parameters

  // Calculate fees based on percentages (denominated in 1e18)
  const PRECISION = 10n ** 18n

  const relayerFees = (amount * fees.totalRelayFee.pct) / PRECISION
  const lpFees = (amount * fees.lpFee.pct) / PRECISION
  const totalFees = relayerFees + lpFees
  const outputAmount = amount - totalFees

  return {
    totalFees,
    relayerFees,
    lpFees,
    outputAmount
  }
}

/**
 * Formats Across fee percentage to human readable format
 *
 * @example
 * formatAcrossFeePercentage(376607094864283n) // "0.0376607094864283"
 */
export function formatAcrossFeePercentage(pct: bigint): string {
  return formatUnits(pct, 16) // Across uses 1e18 for 100%, so 1e16 for 1%
}
