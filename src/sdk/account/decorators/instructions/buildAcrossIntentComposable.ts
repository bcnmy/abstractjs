import {
  type Address,
  type Hex,
  concatHex,
  formatUnits,
  getAddress,
  padHex,
  parseAbi,
  zeroAddress
} from "viem"
import type { Instruction } from "../../../clients/decorators/mee"
import {
  type RuntimeERC20BalanceOfParams,
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf
} from "../../../modules/utils/composabilityCalls"
import { createChainAddressMap } from "../../../modules/utils/createChainAddressMap"
import type { BaseInstructionsParams } from "../build"
import buildBatch from "./buildBatch"
import { buildComposableUtil } from "./buildComposable"
import buildTransfer from "./buildTransfer"

/**
 * Default Across Intent Wrapper address
 */
const defaultAcrossIntentWrapperAddress =
  "0x000000E2E47D694bDAa5a46056A894e747ED2854"

/**
 * Across Intent Wrapper address per chain
 * Should be set for a chain, if it does not match the default one on this given chain
 */
const acrossIntentWrappers = createChainAddressMap([
  // [Number(base.id), "0x000000E2E47D694bDAa5a46056A894e747ED2854"],
])

// 🚀 Across SpokePool addresses
const acrossSpokePool = createChainAddressMap([
  [41455, "0x13fDac9F9b4777705db45291bbFF3c972c6d1d97"], // Aleph Zero
  [42161, "0xe35e9842fceaca96570b734083f4a58e8f7c5f2a"], // Arbitrum
  [421614, "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75"], // Arbitrum Sepolia
  [8453, "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64"], // Base
  [84532, "0x82B564983aE7274c86695917BBf8C99ECb6F0F8F"], // Base Sepolia
  [81457, "0x2D509190Ed0172ba588407D4c2df918F955Cc6E1"], // Blast
  [168587773, "0x5545092553Cf5Bf786e87a87192E902D50D8f022"], // Blast Sepolia
  [56, "0x4e8E101924eDE233C13e2D8622DC8aED2872d505"], // BNB Smart chain
  [1, "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5"], // Ethereum
  [11155111, "0x5ef6C01E11889d86803e0B23e3cB3F9E9d97B662"], // Sepolia
  [57073, "0xeF684C38F94F48775959ECf2012D7E864ffb9dd4"], // Ink
  [232, "0xe7cb3e167e7475dE1331Cf6E0CEb187654619E12"], // Lens
  [59144, "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75"], // Linea
  [1135, "0x9552a0a6624A23B848060AE5901659CDDa1f83f8"], // Lisk
  [4202, "0xeF684C38F94F48775959ECf2012D7E864ffb9dd4"], // Lisk Sepolia
  [34443, "0x3baD7AD0728f9917d1Bf08af5782dCbD516cDd96"], // Mode
  [919, "0xbd886FC0725Cc459b55BbFEb3E4278610331f83b"], // Mode Sepolia
  [10, "0x6f26Bf09B1C792e3228e5467807a900A503c0281"], // Optimism
  [11155420, "0x4e8E101924eDE233C13e2D8622DC8aED2872d505"], // OP Sepolia
  [137, "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096"], // Polygon
  [80002, "0xd08baaE74D6d2eAb1F3320B2E1a53eeb391ce8e5"], // Polygon Mumbai
  [690, "0x13fDac9F9b4777705db45291bbFF3c972c6d1d97"], // Redstone
  [534352, "0x3bad7ad0728f9917d1bf08af5782dcbd516cdd96"], // Scroll
  [1868, "0x3baD7AD0728f9917d1Bf08af5782dCbD516cDd96"], // Soneium
  [130, "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64"], // Unichain
  [1301, "0x6999526e507Cc3b03b180BbE05E1Ff938259A874"], // Unichain Sepolia
  [480, "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64"], // Worldchain
  [324, "0xE0B015E54d54fc84a6cB9B666099c46adE9335FF"], // Zksync
  [7777777, "0x13fDac9F9b4777705db45291bbFF3c972c6d1d97"] // Zora
])

/**
 * Parameters for building a raw composable instruction
 */
export type BuildAcrossIntentComposableParams = {
  depositor: Address
  recipient: Address
  inputToken: Address
  outputToken: Address
  inputAmountRuntimeParams: RuntimeERC20BalanceOfParams
  approximateExpectedInputAmount: bigint // approximate amount of deposited tokens.
  originChainId: number
  destinationChainId: number
  message?: Hex
  relayerAddress?: Address
  pool?: Address
  gasLimit?: bigint
  fees?: SuggestedFeesReturnType
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
    inputAmountRuntimeParams,
    approximateExpectedInputAmount,
    originChainId,
    destinationChainId,
    message,
    relayerAddress,
    gasLimit,
    pool = acrossSpokePool[originChainId],
    fees: fees_
  } = parameters

  // sanity checks
  if (destinationChainId === originChainId) {
    throw new Error("Destination chain and origin should be different")
  }

  if (!pool) {
    throw new Error(
      "Across SpokePool seems not to be present on the origin chain"
    )
  }
  // sanity check for the pool on the dest chain should be held by Across

  const acrossIntentWrapperOnOrigin = _getAcrossIntentWrapper(originChainId)

  // 1. Transfer from Nexus to Wrapper
  // It is required because Across SpokePool deposit functions
  // do transferFrom(msg.sender, address(this), amount)
  // so we need Wrapper to actually have this balance
  const transferFromNexusToWrapperInstruction = await buildTransfer(
    baseParams,
    {
      chainId: originChainId,
      tokenAddress: inputToken,
      amount: runtimeERC20BalanceOf(inputAmountRuntimeParams), // use without changes
      recipient: acrossIntentWrapperOnOrigin
    }
  )

  // 2. Deposit to Pool
  const fees =
    fees_ ??
    (await getAcrossSuggestedFees({
      amount: approximateExpectedInputAmount,
      originChainId,
      inputToken,
      destinationChainId,
      outputToken
    }))

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

  // make a packed uint256 where the first (most significant) 16 bits are the output ratio
  // and the last 16 bits (least significant) are the output ratio precision
  const outputRatioPacked = concatHex([
    padHex(outputRatio.toString(16) as `0x${string}`, { size: 16 }),
    padHex(outputRatioPrecision.toString(16) as `0x${string}`, { size: 16 })
  ])

  // Define Across SpokePool WRAPPER ABI
  const acrossSpokePoolWrapperAbi = parseAbi([
    "function depositV3Composable(address pool, address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputRatioPacked, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes calldata message) external payable"
  ])

  const { constraints } = inputAmountRuntimeParams

  const wrapperRuntimeBalance = runtimeERC20BalanceOf({
    targetAddress: acrossIntentWrapperOnOrigin,
    tokenAddress: inputAmountRuntimeParams.tokenAddress,
    constraints: constraints ?? [greaterThanOrEqualTo(1n)]
  })

  const depositToPoolInstruction = await buildComposableUtil(
    baseParams,
    {
      // BuildComposableParameters
      to: acrossIntentWrapperOnOrigin,
      abi: acrossSpokePoolWrapperAbi,
      functionName: "depositV3Composable",
      args: [
        pool,
        depositor,
        recipient,
        inputToken,
        outputToken,
        wrapperRuntimeBalance, // the runtime param
        outputRatioPacked,
        destinationChainId,
        relayerAddress ?? zeroAddress,
        Number(fees.timestamp),
        Number(fees.fillDeadline),
        0,
        message ?? "0x"
      ],
      chainId: originChainId,
      gasLimit
    },
    true // efficientMode
  )

  return buildBatch(baseParams, {
    instructions: [
      ...transferFromNexusToWrapperInstruction,
      ...depositToPoolInstruction
    ]
  })
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

export type AcrossFeesApiResponse = {
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
      `HTTP error! status: ${response.status}, message: ${response.statusText} <= with url: ${url.toString()}`
    )
  }

  const data = (await response.json()) as AcrossFeesApiResponse

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

const _getAcrossIntentWrapper = (chainId: number) => {
  const acrossIntentWrapper = acrossIntentWrappers.get(chainId)
  if (acrossIntentWrapper) {
    return acrossIntentWrapper
  }
  return defaultAcrossIntentWrapperAddress
}
