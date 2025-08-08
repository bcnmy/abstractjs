import {
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  erc20Abi,
  zeroAddress
} from "viem"
import { encodeFunctionData } from "viem"
import type { MEEVersionConfig } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
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
  recipient,
  version
}: {
  trigger: Trigger
  spender: Address
  recipient: Address
  version: MEEVersionConfig
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
      to: version.ethForwarderAddress,
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

/**
 * Prepares the executable payload required for sending an on-chain quote transaction.
 * This function generates the appropriate call data for the trigger (either native or ERC20),
 * appends the quote hash to the call data, and returns the payload ready for execution.
 * The returned object contains the executable payload and optional metadata (currently empty, but can be extended).
 *
 * @param quoteParams - The on-chain quote parameters, including the quote and trigger
 * @param spender - The address that will be used as the spender (for token approvals)
 * @param recipient - The address that will receive the funds (for native transfers)
 * @returns An object containing the executable payload and metadata
 *
 * @example
 * ```typescript
 * const { executablePayload, metadata } = await prepareExecutableOnChainQuotePayload(
 *   fusionQuote,
 *   spenderAddress,
 *   recipientAddress
 * );
 * // executablePayload: { to, data, value } (ready for sendTransaction)
 * // metadata: {}
 * ```
 */
export const prepareExecutableOnChainQuotePayload = async (
  quoteParams: GetOnChainQuotePayload,
  spender: Address,
  recipient: Address,
  version: MEEVersionConfig
) => {
  const { quote, trigger } = quoteParams

  const triggerCall = await generateTriggerCallFromTrigger({
    trigger,
    spender,
    recipient,
    version
  })

  // This will always be a non-composable transaction, so composability is not a concern here.
  const dataOrPrefix =
    (triggerCall as AbstractCall)?.data ?? FUSION_NATIVE_TRANSFER_PREFIX

  const call = { ...triggerCall, data: concatHex([dataOrPrefix, quote.hash]) }

  return {
    executablePayload: call,
    metadata: {}
  }
}

/**
 * Formats the signed on-chain quote payload by attaching the transaction hash and chainId,
 * and encoding them as required by the MEE service for on-chain quotes.
 * Metadata is currently unused but reserved for future extensibility.
 *
 * @param quoteParams - The original on-chain quote parameters
 * @param _metadata - Optional metadata (currently unused)
 * @param hash - The transaction hash to attach to the quote
 * @returns The signed on-chain quote payload with the signature field
 *
 * @example
 * ```typescript
 * const signedOnChainQuote = formatSignedOnChainQuotePayload(
 *   fusionQuote,
 *   {},
 *   txHash
 * );
 * // signedOnChainQuote: { ...quote, signature: '0x177eee01<encodedHashAndChainId>' }
 * ```
 */
export const formatSignedOnChainQuotePayload = (
  quoteParams: GetOnChainQuotePayload,
  _metadata: Record<string, AnyData>, // This is unused for now. But can be extended in future
  hash: Hex
): SignOnChainQuotePayload => {
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

  const {
    walletClient,
    address: spender,
    version
  } = account_.deploymentOn(trigger.chainId, true)

  // By default the trigger amount will be deposited to sca account.
  // if a custom recipient is defined ? It will deposit to the recipient address
  const recipient = trigger.recipientAddress || spender

  const { executablePayload, metadata } =
    await prepareExecutableOnChainQuotePayload(
      params.fusionQuote,
      spender, // In terms of token approval. Spender will be used for approving for SCA
      recipient, // In terms of native token deposit, this recipient will be used for target deposit address
      version
    )

  // @ts-ignore
  const hash = await walletClient.sendTransaction(executablePayload)

  // @ts-ignore
  await walletClient.waitForTransactionReceipt({ hash, confirmations })

  return formatSignedOnChainQuotePayload(params.fusionQuote, metadata, hash)
}

export default signOnChainQuote
