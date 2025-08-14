import type { MetaMaskSmartAccount } from "@metamask/delegation-toolkit"
import { type Address, encodeFunctionData, erc20Abi, zeroAddress } from "viem"
import type { BuildInstructionTypes } from "../../../account/decorators/build"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { batchInstructions } from "../../../account/utils/batchInstructions"
import { ForwarderAbi } from "../../../constants/abi/ForwarderAbi"
import type { RuntimeValue } from "../../../modules"
import {
  greaterThanOrEqualTo,
  runtimeERC20AllowanceOf
} from "../../../modules/utils/composabilityCalls"
import type { BaseMeeClient } from "../../createMeeClient"
import getMmDtkQuote, { type GetMmDtkQuoteParams } from "./getMmDtkQuote"
import getOnChainQuote, { type GetOnChainQuotePayload } from "./getOnChainQuote"
import { type GetPaymentTokenPayload, getPaymentToken } from "./getPaymentToken"
import getPermitQuote, { type GetPermitQuotePayload } from "./getPermitQuote"
import {
  type CleanUp,
  DEFAULT_GAS_LIMIT,
  type GetQuoteParams,
  type Instruction
} from "./getQuote"
import { getQuoteType } from "./getQuoteType"
import type { Trigger } from "./signPermitQuote"

/**
 * Union type representing the possible quote payloads returned by getFusionQuote
 * @see {@link GetPermitQuotePayload} - Payload when permit is enabled
 * @see {@link GetOnChainQuotePayload} - Payload when using standard on-chain transactions
 */
export type GetFusionQuotePayload =
  | GetPermitQuotePayload
  | GetOnChainQuotePayload

/**
 * Parameters for getting a fusion quote
 */
export type GetFusionQuoteParams = GetQuoteParams & {
  /**
   * Trigger information for the transaction
   * Contains details about the payment token and chain
   * @see {@link Trigger}
   */
  trigger: Trigger
  /**
   * token cleanup option to pull the funds on failure or dust cleanup
   */
  cleanUps?: CleanUp[]

  feePayer?: undefined
  /**
   * Optional delegator smart account
   * If not provided, that means the Delegation Toolkit fusion
   * mode won't be used
   */
  delegatorSmartAccount?: MetaMaskSmartAccount
}

/**
 * Gets a quote using either permit or standard on-chain transaction based on token capabilities.
 * This function automatically determines whether to use permit-based or standard transactions
 * by checking the payment token's permit support.
 *
 * @param client - The Mee client instance used for API interactions
 * @param parameters - Parameters for generating the quote
 * @param parameters.trigger - Transaction trigger information
 * @param parameters.instructions - Array of transaction instructions to be executed
 * @param parameters.chainId - Target blockchain chain ID
 * @param parameters.walletProvider - Wallet provider to use
 * @param [parameters.gasToken] - Optional token address to use for gas payment
 * @param [parameters.fusionMode] - Optional explicitly set fusion mode
 *
 * @returns Promise resolving to either a permit quote or on-chain quote payload
 *
 * @example
 * ```typescript
 * const quote = await getFusionQuote(client, {
 *   chainId: "1",
 *   walletProvider: "metamask",
 *   trigger: {
 *     chainId: "1",
 *     paymentToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
 *   },
 *   instructions: [{
 *     to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *     data: "0x...",
 *     value: "0"
 *   }]
 * });
 * // Returns either GetPermitQuotePayload or GetOnChainQuotePayload
 * // depending on USDC's permit support
 * ```
 *
 * @throws Will throw an error if:
 * - The payment token information cannot be retrieved
 * - The quote generation fails
 * - The API request fails
 */
export const getFusionQuote = async (
  client: BaseMeeClient,
  parameters: GetFusionQuoteParams
): Promise<GetFusionQuotePayload> => {
  // if delegator smart account is provided, we use mm-dtk fusion mode
  if (parameters.delegatorSmartAccount) {
    return getMmDtkQuote(client, parameters as GetMmDtkQuoteParams)
  }
  // if it is not mm-dtk, then it is permit or on-chain

  const trigger = parameters.trigger

  let paymentTokenInfo: GetPaymentTokenPayload | undefined = undefined

  if (trigger.tokenAddress) {
    paymentTokenInfo = await getPaymentToken(client, {
      tokenAddress: trigger.tokenAddress,
      chainId: trigger.chainId
    })
  }

  const { walletClient } = client.account.deploymentOn(trigger.chainId, true)

  const signatureType = await getQuoteType(
    walletClient,
    parameters,
    paymentTokenInfo
  )

  switch (signatureType) {
    case "permit":
      return getPermitQuote(client, parameters)
    case "onchain":
      return getOnChainQuote(client, parameters)
    default:
      throw new Error("Invalid quote type for fusion quote")
  }
}

export type PrepareInstructionsParams = {
  resolvedInstructions: Instruction[]
  trigger: Trigger
  owner: Address
  spender: Address
  recipient: Address
  account: MultichainSmartAccount
}

export const prepareInstructions = async (
  client: BaseMeeClient,
  parameters: PrepareInstructionsParams
) => {
  const { resolvedInstructions, trigger, owner, spender, recipient, account } =
    parameters

  let triggerAmount = 0n

  if (trigger.useMaxAvailableFunds) {
    const { publicClient } = client.account.deploymentOn(trigger.chainId, true)
    if (trigger.tokenAddress === zeroAddress) {
      const { version } = account.deploymentOn(trigger.chainId, true)

      const forwardCalldata = encodeFunctionData({
        abi: ForwarderAbi,
        functionName: "forward",
        args: [recipient]
      })

      const [balance, gasPrice, gasLimit] = await Promise.all([
        publicClient.getBalance({ address: owner }),
        publicClient.getGasPrice(),
        publicClient.estimateGas({
          account: owner,
          to: version.ethForwarderAddress,
          data: forwardCalldata,
          value: 100n // Dummy amount
        })
      ])

      // 100% gas limit buffer to avoid failures
      const gasLimitWithBuffer = (gasLimit * 200n) / 100n

      // 100% buffer for gas price fluctuations
      const gasBuffer = 2

      const baseCost = gasLimitWithBuffer * gasPrice
      const gasReserve = BigInt(Math.ceil(Number(baseCost) * gasBuffer))

      if (balance <= gasReserve) {
        throw new Error("Not enough native token to transfer")
      }

      // native token balance maximum available balance fetch
      triggerAmount = balance - gasReserve
    } else {
      // EOA balance maximum available balance fetch
      triggerAmount = await publicClient.readContract({
        address: trigger.tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner]
      })
    }
  } else {
    if (!trigger.amount) throw new Error("Trigger amount field is required")

    triggerAmount = trigger.amount
  }

  let isComposable = resolvedInstructions.some(
    ({ isComposable }) => isComposable
  )

  let transferFromAmount: bigint | RuntimeValue = 0n

  // If max available funds ? the entire balance from EOA is added as transfer amount. But the fees will be taken from this
  // So we don't know a specific amount to be defined here before getting the quote. So we take runtimeBalance which will take
  // the remaining funds after the fee deduction.
  if (trigger.useMaxAvailableFunds && trigger.tokenAddress !== zeroAddress) {
    transferFromAmount = runtimeERC20AllowanceOf({
      owner,
      spender,
      tokenAddress: trigger.tokenAddress,
      constraints: [greaterThanOrEqualTo(1n)]
    })

    // If max funds is used, it will be always composable
    isComposable = true
  } else {
    transferFromAmount = triggerAmount
  }

  const triggerGasLimit = trigger.gasLimit
    ? trigger.gasLimit
    : DEFAULT_GAS_LIMIT

  // If token address is zero address, we don't need to add transferFrom instruction
  if (trigger.tokenAddress === zeroAddress) {
    const batchedInstructions = await batchInstructions({
      account,
      instructions: resolvedInstructions
    })
    return { triggerGasLimit, triggerAmount, batchedInstructions }
  }

  const params: BuildInstructionTypes = {
    type: "transferFrom",
    data: {
      tokenAddress: trigger.tokenAddress!,
      chainId: trigger.chainId,
      amount: transferFromAmount,
      recipient,
      sender: owner,
      gasLimit: triggerGasLimit
    }
  }
  const triggerTransfer = await (isComposable
    ? account.buildComposable(params)
    : account.build(params))

  const batchedInstructions = await batchInstructions({
    account,
    instructions: [...triggerTransfer, ...resolvedInstructions]
  })

  return { triggerGasLimit, triggerAmount, batchedInstructions }
}

export default getFusionQuote
