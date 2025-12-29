import {
  OperationType,
  type SafeTransaction,
  type SafeTransactionDataPartial
} from "@safe-global/types-kit"
import {
  http,
  type Address,
  type Hex,
  type LocalAccount,
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  keccak256,
  zeroAddress
} from "viem"
import { toAccount } from "viem/accounts"
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
 * Extracts unique chain IDs from the quote's userOps, excluding the payment
 * chain if the quote is sponsored (since the payment userOp at index 0 is
 * handled by the sponsor in that case).
 *
 * @param quote - The quote payload containing userOps and payment info
 * @returns Array of unique chain IDs where the Safe must be deployed
 */
const getInvolvedChainIds = (quote: GetQuotePayload): number[] => {
  const { userOps, paymentInfo } = quote
  const isSponsored = paymentInfo.sponsored === true

  // If sponsored, skip the first userOp (payment userOp) as it's handled by sponsor
  const relevantUserOps = isSponsored ? userOps.slice(1) : userOps

  const chainIds = relevantUserOps.map((op) => Number(op.chainId))
  return [...new Set(chainIds)]
}

/**
 * Validates that the Safe is deployed on all chains involved in the supertransaction.
 * Throws an error if the Safe is not deployed on any required chain.
 *
 * @param client - The Mee client instance
 * @param quote - The quote payload containing userOps
 * @param safeAddress - The Safe address to validate
 * @throws Error if Safe is not deployed on any required chain
 */
export const validateSafeDeployment = async (
  client: BaseMeeClient,
  quote: GetQuotePayload,
  safeAddress: Address
): Promise<void> => {
  const chainIds = getInvolvedChainIds(quote)

  const deploymentChecks = await Promise.all(
    chainIds.map(async (chainId) => {
      const deployment = client.account.deploymentOn(chainId, false)
      if (!deployment) {
        return { chainId, deployed: false, reason: "no deployment config" }
      }

      const publicClient = createPublicClient({
        chain: deployment.client.chain,
        transport: http()
      })

      const code = await publicClient.getCode({ address: safeAddress })
      const isDeployed = code !== undefined && code !== "0x"

      return { chainId, deployed: isDeployed }
    })
  )

  const undeployedChains = deploymentChecks.filter((check) => !check.deployed)

  if (undeployedChains.length > 0) {
    const chainList = undeployedChains.map((c) => c.chainId).join(", ")
    throw new Error(
      `Safe at ${safeAddress} is not deployed on chains: ${chainList}. Safe must be deployed on all chains involved in the supertransaction.`
    )
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

  // Validate Safe is deployed on all chains involved in the supertransaction
  await validateSafeDeployment(
    client,
    fusionQuote.quote,
    parameters.safeAccount
  )

  const txnData = signedSafeTxn.data

  const signatures = signedSafeTxn.encodedSignatures()

  const ogDomainSeparator = computeSafeDomainSeparator(
    parameters.safeAccount,
    fusionQuote.trigger.chainId
  )

  const safeTxData = {
    ogDomainSeparator,
    to: txnData.to as `0x${string}`,
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

/**
 * Creates a mock signer that uses the Safe address as the signer address.
 *
 * This signer is intended for use with `toMultichainNexusAccount` when the
 * orchestrator should be owned by a Safe multisig. The actual signing happens
 * through the Safe's multisig flow (using protocol-kit), not through this signer.
 *
 * The returned signer:
 * - Has `address` set to the Safe's address
 * - Will throw an error if any signing method is called
 * - Can only be used with Safe-mode operations (getSafeQuote, signSafeQuote, etc.)
 *
 * @param safeAddress - The address of the Safe multisig
 * @returns A LocalAccount-compatible mock signer with the Safe address
 *
 * @example
 * ```typescript
 * import { getMockSafeSigner } from "@biconomy/abstractjs"
 *
 * const safeAddress = "0x..." // Your Safe multisig address
 * const safeSigner = getMockSafeSigner(safeAddress)
 *
 * // Create a multichain Nexus account owned by the Safe
 * const mcNexus = await toMultichainNexusAccount({
 *   signer: safeSigner,
 *   chainConfigurations: [
 *     { chain: baseSepolia, transport: http(), version: getMEEVersion(MEEVersion.V2_3_0) },
 *     { chain: optimismSepolia, transport: http(), version: getMEEVersion(MEEVersion.V2_3_0) }
 *   ]
 * })
 *
 * // The Nexus orchestrator is now owned by the Safe
 * // Use getSafeQuote and signSafeQuote for transactions
 * ```
 */
export const getMockSafeSigner = (safeAddress: Address): LocalAccount => {
  return toAccount({
    address: safeAddress,
    async signMessage(_): Promise<Hex> {
      throw new Error(
        "signMessage is not supported for Safe-owned signer. " +
          "Use protocol-kit to sign Safe transactions instead."
      )
    },
    async signTransaction(_): Promise<Hex> {
      throw new Error(
        "signTransaction is not supported for Safe-owned signer. " +
          "Use protocol-kit to sign Safe transactions instead."
      )
    },
    async signTypedData(_): Promise<Hex> {
      throw new Error(
        "signTypedData is not supported for Safe-owned signer. " +
          "Use protocol-kit to sign Safe transactions instead."
      )
    }
  })
}

export default signSafeQuote
