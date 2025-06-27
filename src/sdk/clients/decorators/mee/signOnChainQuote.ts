import {
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  zeroAddress
} from "viem"
import { encodeFunctionData } from "viem"
import type { BuildApproveParameters } from "../../../account/decorators/instructions/buildApprove"
import type { BuildDefaultParameters } from "../../../account/decorators/instructions/buildDefaultInstructions"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { FORWARDER_ADDRESS } from "../../../constants"
import { ForwarderAbi } from "../../../constants/abi/ForwarderAbi"
import type { ComposableCall } from "../../../modules/utils/composabilityCalls"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { AbstractCall, GetQuotePayload } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

export const FUSION_NATIVE_TRANSFER_PREFIX = "0x150b7a02"

export type SignOnChainQuotePayload = GetQuotePayload & {
  /** The signature of the quote */
  signature: Hex
}

export type SignOnChainQuoteParams = {
  /** The quote to sign */
  fusionQuote: GetOnChainQuotePayload
  /** Optional smart account to execute the transaction. If not provided, uses the client's default account */
  account?: MultichainSmartAccount
  /** The number of confirmations to wait for. Defaults to 2 */
  confirmations?: number
}

export const ON_CHAIN_PREFIX = "0x177eee01"

/**
 * Generates a trigger call from a trigger
 * @private
 */
const generateTriggerCallFromTrigger = async ({
  account,
  spender,
  trigger
}: {
  account: MultichainSmartAccount
  spender: Address
  trigger: Trigger
}) => {
  let triggerCall: AbstractCall | ComposableCall
  // build custom call
  if (trigger.call) {
    triggerCall = trigger.call
  } else if (trigger.tokenAddress === zeroAddress) {
    // If the token address is zero address, we need to send eth via the ETH forwarder
    const forwardCalldata = encodeFunctionData({
      abi: ForwarderAbi,
      functionName: "forward",
      args: [spender]
    })
    const [
      {
        calls: [ethForwardCall]
      }
    ] = await account.build({
      type: "default",
      data: {
        calls: [
          {
            to: FORWARDER_ADDRESS,
            data: forwardCalldata,
            value: trigger.amount
          }
        ],
        chainId: trigger.chainId
      } as BuildDefaultParameters
    })
    triggerCall = ethForwardCall
  } else {
    // erc20 trigger

    // check if we have an explicit `approvalAmount` set and error if it's smaller than the trigger amount
    if (
      trigger.approvalAmount &&
      trigger.amount !== undefined &&
      trigger.approvalAmount < trigger.amount
    ) {
      throw new Error(
        `Approval amount must be bigger or equal with the amount from the trigger (triggerAmount: ${trigger.amount} amount: ${trigger.approvalAmount})`
      )
    }

    const amount = trigger.approvalAmount ?? trigger.amount

    const [
      {
        calls: [approveCall]
      }
    ] = await account.build({
      type: "approve",
      data: {
        spender,
        tokenAddress: trigger.tokenAddress,
        chainId: trigger.chainId,
        amount
      } as BuildApproveParameters
    })
    triggerCall = approveCall
  }
  return triggerCall
}

/**
 * Signs a fusion quote with a tx send client side.
 *
 * @param client - The Mee client to use
 * @param params - The parameters for the fusion quote
 * @returns The signed quote
 * @example
 * const signedQuote = await signOnChainQuote(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount
 * })
 */
export const signOnChainQuote = async (
  client: BaseMeeClient,
  params: SignOnChainQuoteParams
): Promise<SignOnChainQuotePayload> => {
  const {
    confirmations = 2,
    account: account_ = client.account,
    fusionQuote: { quote, trigger }
  } = params

  const chainId = trigger.chainId

  const {
    chain,
    walletClient,
    address: spender
  } = account_.deploymentOn(chainId, true)

  const triggerCall = await generateTriggerCallFromTrigger({
    account: account_,
    trigger,
    spender
  })

  // This will be always a non composable transaction, so don't worry about the composability
  const dataOrPrefix =
    (triggerCall as AbstractCall)?.data ?? FUSION_NATIVE_TRANSFER_PREFIX
  const call = { ...triggerCall, data: concatHex([dataOrPrefix, quote.hash]) }

  // @ts-ignore
  const hash = await walletClient.sendTransaction(call)
  // @ts-ignore
  await walletClient.waitForTransactionReceipt({ hash, confirmations })

  const signature = concatHex([
    ON_CHAIN_PREFIX,
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [hash, BigInt(chain.id)]
    )
  ])

  return {
    ...quote,
    signature
  }
}

export default signOnChainQuote
