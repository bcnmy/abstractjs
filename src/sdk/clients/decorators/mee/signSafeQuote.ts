import {
  OperationType,
  type SafeTransaction,
  type SafeTransactionDataPartial
} from "@safe-global/types-kit"
import {
  type Address,
  type Hex,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  zeroAddress
} from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { ForwarderAbi } from "../../../constants/abi/ForwarderAbi"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload } from "./getQuote"
import type { GetSafeQuotePayload } from "./getSafeQuote"

/**
 * Safe transaction data structure matching the Solidity SafeTxnData struct
 */
export interface SafeTxnDataForNode {
  /** Original domain separator of the Safe */
  ogDomainSeparator: Hex
  /** Target address of the transaction */
  to: Address
  /** Value in wei to send */
  value: bigint
  /** Transaction calldata (with supertxn hash appended) */
  data: Hex
  /** Operation type (Call or DelegateCall) */
  operation: OperationType
  /** Gas allocated for the Safe transaction execution */
  safeTxGas: bigint
  /** Base gas (stipend) for data and signature checks */
  baseGas: bigint
  /** Gas price for refund calculation */
  gasPrice: bigint
  /** Token address for gas payment (zero address for ETH) */
  gasToken: Address
  /** Address to receive gas payment refund */
  refundReceiver: Address
  /** Safe nonce for this transaction */
  nonce: bigint
  /** Concatenated signatures from Safe owners */
  signatures: Hex
}

/**
 * Parameters for signing a Safe quote
 */
export type SignSafeQuoteParams = {
  /**
   * The quote to sign
   * @see {@link GetSafeQuotePayload}
   */
  fusionQuote: GetSafeQuotePayload
  /**
   * The Safe transaction
   */
  signedSafeTxn: SafeTransaction
  /**
   * The Safe master account address
   */
  safeAccount: Address
}

/**
 * Response payload containing the signed Safe quote
 */
export type SignSafeQuotePayload = GetQuotePayload & {
  /**
   * The signature of the quote, prefixed with '0x177eee04' and concatenated with
   * the encoded Safe transaction data and signature components
   */
  signature: Hex
}

// Safe SA mode prefix - 0x177eee04 for Safe Smart Account mode
export const SAFE_SA_PREFIX = "0x177eee04" as const

// Safe EIP-712 domain typehash
// keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")
const SAFE_DOMAIN_TYPEHASH =
  "0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218" as const

/**
 * Computes the Safe domain separator for a given Safe address and chain
 */
export const computeSafeDomainSeparator = (
  safeAddress: Address,
  chainId: number
): Hex => {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, // DOMAIN_TYPEHASH
        { type: "uint256" }, // chainId
        { type: "address" } // verifyingContract (Safe address)
      ],
      [SAFE_DOMAIN_TYPEHASH, BigInt(chainId), safeAddress]
    )
  )
}

/**
 * Formats the signed Safe quote payload by encoding the Safe transaction data
 * and signatures as required by the K1MeeValidator.
 *
 * @param quoteParams - The original Safe quote parameters
 * @param safeTxData - The Safe transaction data
 * @param signatures - The concatenated signatures from Safe owners
 * @returns The signed Safe quote payload
 */
export const formatSignedSafeQuotePayload = (
  quoteParams: GetSafeQuotePayload,
  safeTxData: Omit<SafeTxnDataForNode, "signatures">,
  signatures: Hex
): SignSafeQuotePayload => {
  const { quote } = quoteParams

  // Encode the SafeTxnData struct for the signature
  const encodedSafeTxnData = encodeAbiParameters(
    [
      {
        name: "safeTxnData",
        type: "tuple",
        components: [
          { name: "ogDomainSeparator", type: "bytes32" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "operation", type: "uint8" },
          { name: "safeTxGas", type: "uint256" },
          { name: "baseGas", type: "uint256" },
          { name: "gasPrice", type: "uint256" },
          { name: "gasToken", type: "address" },
          { name: "refundReceiver", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "signatures", type: "bytes" }
        ]
      }
    ],
    [
      {
        ogDomainSeparator: safeTxData.ogDomainSeparator,
        to: safeTxData.to,
        value: safeTxData.value,
        data: safeTxData.data,
        operation: safeTxData.operation,
        safeTxGas: safeTxData.safeTxGas,
        baseGas: safeTxData.baseGas,
        gasPrice: safeTxData.gasPrice,
        gasToken: safeTxData.gasToken,
        refundReceiver: safeTxData.refundReceiver,
        nonce: safeTxData.nonce,
        signatures
      }
    ]
  )

  return {
    ...quote,
    signature: concatHex([SAFE_SA_PREFIX, encodedSafeTxnData])
  }
}

/**
 * Signs a Safe quote for the Safe Smart Account fusion mode.
 * This enables using a Gnosis Safe multisig as the master account for supertransactions.
 *
 * The flow works by:
 * 1. Creating a Safe transaction that approves tokens for the orchestrator
 * 2. Appending the supertxn hash to the Safe transaction calldata
 * 3. Collecting signatures from Safe owners
 * 4. Encoding the Safe transaction + signatures as the userOp signature
 *
 * @param client - The Mee client instance
 * @param parameters - Parameters for signing the Safe quote
 * @param parameters.fusionQuote - The Safe quote to sign
 * @param parameters.safeWalletClient - Wallet client for signing the Safe transaction
 * @param parameters.safeAccount - The Safe address
 * @param parameters.executeTrigger - Whether to execute trigger during validation (default: true)
 *
 * @returns Promise resolving to the quote payload with Safe signature
 *
 * @example
 * ```typescript
 * const signedSafeQuote = await signSafeQuote(meeClient, {
 *   fusionQuote: {
 *     quote: quotePayload,
 *     trigger: {
 *       tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *       chainId: 1,
 *       amount: 1000000n // 1 USDC
 *     }
 *   },
 *   safeWalletClient: safeClient, // Configured Safe wallet client
 *   safeAccount: "0x..." // Safe address
 * });
 * ```
 */
export const signSafeQuote = async (
  client: BaseMeeClient,
  parameters: SignSafeQuoteParams
): Promise<SignSafeQuotePayload> => {
  const { fusionQuote, signedSafeTxn } = parameters
  const txnData = signedSafeTxn.data

  const signatures = signedSafeTxn.encodedSignatures()

  const ogDomainSeparator = computeSafeDomainSeparator(
    parameters.safeAccount,
    fusionQuote.trigger.chainId
  )

  const safeTxData = {
    ogDomainSeparator,
    to: txnData.to,
    value: BigInt(txnData.value),
    data: txnData.data as Hex,
    operation: txnData.operation,
    safeTxGas: BigInt(txnData.safeTxGas),
    baseGas: BigInt(txnData.baseGas),
    gasPrice: BigInt(txnData.gasPrice),
    gasToken: txnData.gasToken as Address,
    refundReceiver: txnData.refundReceiver as Address,
    nonce: BigInt(txnData.nonce),
    signatures: signatures as Hex
  }

  return formatSignedSafeQuotePayload(
    parameters.fusionQuote,
    safeTxData,
    signatures as Hex
  )
}

export function getDataToPrepareSafeTransaction(
  client: BaseMeeClient,
  quoteParams: GetSafeQuotePayload,
  companionAccount?: MultichainSmartAccount
): SafeTransactionDataPartial {
  const { quote, trigger } = quoteParams

  if (trigger.call) {
    throw new Error(
      "Custom triggers are not supported for Safe fusion transactions"
    )
  }

  if (!trigger.amount) {
    throw new Error("Amount is required to sign a Safe quote")
  }

  const account = companionAccount ?? client.account

  const spender = account.addressOn(trigger.chainId, true)
  const recipient = trigger.recipientAddress || spender
  const { version } = account.deploymentOn(trigger.chainId, true)
  const ethForwarderAddress = version.ethForwarderAddress

  const amount = trigger.approvalAmount ?? trigger.amount!

  let to: Address
  let value: bigint
  let calldata: Hex

  if (trigger.tokenAddress === zeroAddress) {
    // Native token case: call the ETH forwarder contract
    const forwardCalldata = encodeFunctionData({
      abi: ForwarderAbi,
      functionName: "forward",
      args: [recipient]
    })
    to = ethForwarderAddress
    value = amount
    calldata = forwardCalldata
  } else {
    // ERC20 token case: approve the spender
    const approveCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount]
    })
    to = trigger.tokenAddress!
    value = 0n
    calldata = approveCalldata
  }

  // Append the supertxn hash to the calldata
  const dataWithHash = concatHex([calldata, quote.hash])

  return {
    to,
    value: value.toString(),
    data: dataWithHash,
    operation: OperationType.Call
  }
}

export default signSafeQuote
