import {
  type Address,
  type Hex,
  type WalletClient,
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
 * Safe transaction operation type
 * 0 = Call (regular transaction)
 * 1 = DelegateCall
 */
export enum SafeOperation {
  Call = 0,
  DelegateCall = 1
}

/**
 * Safe transaction data structure matching the Solidity SafeTxnData struct
 */
export interface SafeTxnData {
  /** Original domain separator of the Safe */
  ogDomainSeparator: Hex
  /** Target address of the transaction */
  to: Address
  /** Value in wei to send */
  value: bigint
  /** Transaction calldata (with supertxn hash appended) */
  data: Hex
  /** Operation type (Call or DelegateCall) */
  operation: SafeOperation
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
   * The Safe wallet client used for signing the Safe transaction.
   * This should be a wallet client configured for the Safe that can
   * collect signatures from the required owners.
   */
  safeWalletClient: WalletClient
  /**
   * The Safe account address that holds the funds
   */
  safeAccount: Address
  /**
   * Optional companion smart account to execute the superTxn
   * If not provided, uses the client's default account
   */
  companionAccount?: MultichainSmartAccount
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

// Safe transaction typehash for EIP-712
// keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)")
export const SAFE_TX_TYPEHASH =
  "0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8" as const

// Safe EIP-712 domain typehash
// keccak256("EIP712Domain(uint256 chainId,address verifyingContract)")
const SAFE_DOMAIN_TYPEHASH =
  "0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218" as const

// Minimal Safe ABI for reading nonce
const SAFE_ABI = [
  {
    inputs: [],
    name: "nonce",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const

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
 * Computes the Safe transaction hash for signing
 */
export const computeSafeTxHash = (
  domainSeparator: Hex,
  safeTxData: Omit<SafeTxnData, "ogDomainSeparator" | "signatures">
): Hex => {
  const encodedData = encodeAbiParameters(
    [
      { type: "bytes32" }, // SAFE_TX_TYPEHASH
      { type: "address" }, // to
      { type: "uint256" }, // value
      { type: "bytes32" }, // keccak256(data)
      { type: "uint8" }, // operation
      { type: "uint256" }, // safeTxGas
      { type: "uint256" }, // baseGas
      { type: "uint256" }, // gasPrice
      { type: "address" }, // gasToken
      { type: "address" }, // refundReceiver
      { type: "uint256" } // nonce
    ],
    [
      SAFE_TX_TYPEHASH,
      safeTxData.to,
      safeTxData.value,
      keccak256(safeTxData.data),
      safeTxData.operation,
      safeTxData.safeTxGas,
      safeTxData.baseGas,
      safeTxData.gasPrice,
      safeTxData.gasToken,
      safeTxData.refundReceiver,
      safeTxData.nonce
    ]
  )

  const structHash = keccak256(encodedData)

  // EIP-712 final hash: keccak256("\x19\x01" || domainSeparator || structHash)
  return keccak256(concatHex(["0x1901", domainSeparator, structHash]))
}

/**
 * Prepares the signable Safe transaction payload.
 * This function creates the Safe transaction data structure that needs to be signed
 * by the Safe owners to approve token spending or forward native ETH for the supertransaction.
 *
 * @param quoteParams - The Safe quote parameters
 * @param safeAccount - The Safe address
 * @param spender - The address that will be approved to spend tokens (Nexus orchestrator)
 * @param recipient - The address that will receive the funds (for native transfers)
 * @param chainId - The chain ID where the Safe is deployed
 * @param safeNonce - The current nonce of the Safe
 * @param ethForwarderAddress - The address of the ETH forwarder contract (for native token transfers)
 * @returns Object containing the Safe transaction data and metadata
 */
export const prepareSignableSafeQuotePayload = async (
  quoteParams: GetSafeQuotePayload,
  safeAccount: Address,
  spender: Address,
  recipient: Address,
  chainId: number,
  safeNonce: bigint,
  ethForwarderAddress: Address
): Promise<{
  safeTxData: Omit<SafeTxnData, "signatures">
  safeTxHash: Hex
}> => {
  const { quote, trigger } = quoteParams

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

  // Compute domain separator
  const domainSeparator = computeSafeDomainSeparator(safeAccount, chainId)

  // Build Safe transaction data
  const safeTxData: Omit<SafeTxnData, "signatures"> = {
    ogDomainSeparator: domainSeparator,
    to,
    value,
    data: dataWithHash,
    operation: SafeOperation.Call,
    safeTxGas: 0n, // Let Safe estimate
    baseGas: 0n,
    gasPrice: 0n, // No refund
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
    nonce: safeNonce
  }

  // Compute the Safe transaction hash that needs to be signed
  const safeTxHash = computeSafeTxHash(domainSeparator, safeTxData)

  return {
    safeTxData,
    safeTxHash
  }
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
  safeTxData: Omit<SafeTxnData, "signatures">,
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
  const {
    companionAccount: account_ = client.account,
    safeWalletClient,
    safeAccount,
    fusionQuote: { trigger }
  } = parameters

  if (trigger.call) {
    throw new Error(
      "Custom triggers are not supported for Safe fusion transactions"
    )
  }

  if (!trigger.amount) {
    throw new Error("Amount is required to sign a Safe quote")
  }

  const spender = account_.addressOn(trigger.chainId, true)

  // By default the trigger amount will be deposited to the companion smart account.
  // If a custom recipient is defined, it will deposit to the recipient address
  const recipient = trigger.recipientAddress || spender

  // Get the public client and version for the trigger chain
  const { publicClient, version } = account_.deploymentOn(trigger.chainId, true)

  // Fetch the Safe nonce from the contract
  const safeNonce = await publicClient.readContract({
    address: safeAccount,
    abi: SAFE_ABI,
    functionName: "nonce"
  })

  const { safeTxData, safeTxHash } = await prepareSignableSafeQuotePayload(
    parameters.fusionQuote,
    safeAccount,
    spender,
    recipient,
    trigger.chainId,
    safeNonce,
    version.ethForwarderAddress
  )

  // Sign the Safe transaction hash
  // TODO: research some Safe wallet SDK ,
  // which signers it provides and what the signer object returns
  const signatures = await safeWalletClient.signMessage({
    account: safeWalletClient.account!,
    message: { raw: safeTxHash }
  })

  return formatSignedSafeQuotePayload(
    parameters.fusionQuote,
    safeTxData,
    signatures
  )
}

export default signSafeQuote
