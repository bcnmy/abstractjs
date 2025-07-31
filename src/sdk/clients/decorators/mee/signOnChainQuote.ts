import {
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  erc20Abi,
  zeroAddress
} from "viem"
import { encodeFunctionData } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { FORWARDER_ADDRESS } from "../../../constants"
import { ForwarderAbi } from "../../../constants/abi/ForwarderAbi"
import type { AnyData } from "../../../modules"
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
  /** Optional companion smart account to execute the superTxn. If not provided, uses the client's default account */
  companionAccount?: MultichainSmartAccount
  /** The number of confirmations to wait for. Defaults to 2 */
  confirmations?: number
}

export const ON_CHAIN_PREFIX = "0x177eee01"

/**
 * Generates a trigger call from a trigger
 * @private
 */
const generateTriggerCallFromTrigger = async ({
  trigger,
  spender,
  recipient
}: {
  trigger: Trigger
  spender: Address
  recipient: Address
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
      args: [recipient]
    })

    const ethForwardCall: AbstractCall = {
      to: FORWARDER_ADDRESS,
      data: forwardCalldata,
      value: trigger.amount
    }

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

    if (!amount) throw new Error("Invalid trigger amount")

    const approveCall: AbstractCall = {
      to: trigger.tokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount]
      })
    }

    triggerCall = approveCall
  }

  return triggerCall
}

export const prepareExecutableOnChainQuotePayload = async (
  quoteParams: GetOnChainQuotePayload,
  spender: Address,
  recipient: Address
) => {
  const { quote, trigger } = quoteParams

  const triggerCall = await generateTriggerCallFromTrigger({
    trigger,
    spender,
    recipient
  })

  // This will be always a non composable transaction, so don't worry about the composability
  const dataOrPrefix =
    (triggerCall as AbstractCall)?.data ?? FUSION_NATIVE_TRANSFER_PREFIX

  const call = { ...triggerCall, data: concatHex([dataOrPrefix, quote.hash]) }

  return {
    executablePayload: call,
    metadata: {}
  }
}

export const formatSignedOnChainQuotePayload = (
  quoteParams: GetOnChainQuotePayload,
  _metadata: Record<string, AnyData>, // This is unused for now. But can be extended in future
  hash: Hex
) => {
  const { quote, trigger } = quoteParams

  const signature = concatHex([
    ON_CHAIN_PREFIX,
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint256" }],
      [hash, BigInt(trigger.chainId)]
    )
  ])

  return {
    ...quote,
    signature
  }
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
    companionAccount: account_ = client.account,
    fusionQuote: { trigger }
  } = params

  const { walletClient, address: spender } = account_.deploymentOn(
    trigger.chainId,
    true
  )

  // By default the trigger amount will be deposited to sca account.
  // if a custom recipient is defined ? It will deposit to the recipient address
  const recipient = trigger.recipientAddress || spender

  const { executablePayload, metadata } =
    await prepareExecutableOnChainQuotePayload(
      params.fusionQuote,
      spender, // In terms of token approval. Spender will be used for approving for SCA
      recipient // In terms of native token deposit, this recipient will be used for target deposit address
    )

  // @ts-ignore
  const hash = await walletClient.sendTransaction(executablePayload)

  // @ts-ignore
  await walletClient.waitForTransactionReceipt({ hash, confirmations })

  return formatSignedOnChainQuotePayload(params.fusionQuote, metadata, hash)
}

export default signOnChainQuote
