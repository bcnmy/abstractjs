import {
  type Address,
  type Hex,
  type OneOf,
  type PublicClient,
  type SignTypedDataParameters,
  type WalletClient,
  concatHex,
  encodeAbiParameters,
  getContract,
  parseSignature
} from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { PERMIT_TYPEHASH } from "../../../constants"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { AbstractCall, GetQuotePayload } from "./getQuote"

/**
 * Signable permit quote payload which can be signed by pure/custom signers
 */
export type SignablePermitPayload = Omit<SignTypedDataParameters, "account">

export interface PermitMetadata {
  nonce: bigint
  name: string
  version: string
  domainSeparator: Hex
  owner: Address
  spender: Address
  amount: bigint
}

export interface SignablePermitQuotePayload {
  signablePayload: SignablePermitPayload
  metadata: PermitMetadata
}

/**
 * Custom trigger for arbitrary calls
 */
export type CustomTrigger = {
  /**
   * The call to execute
   * @see {@link AbstractCall}
   */
  call: AbstractCall
  /**
   * The chainId to use
   * @example 1 // Ethereum Mainnet
   */
  chainId: number
}

/**
 * Parameters for a token trigger
 */
export type TokenTrigger = {
  /**
   * The address of the token to use on the relevant chain
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
   */
  tokenAddress: Address
  /**
   * The chainId to use
   * @example 1 // Ethereum Mainnet
   */
  chainId: number
  /**
   * Defaults to EOA's Nexus SCA account address. If this is provided, the trigger.amount will be deposited
   * to this address
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  recipientAddress?: Address
  /**
   * custom gas limit can be added to override the default 50_000 gas limit
   */
  gasLimit?: bigint
} & OneOf<
  | {
      /**
       * Whether to use max available funds from the EOA wallet to be pulled into SCA after fee deduction.
       * default is false
       */
      useMaxAvailableFunds: true
    }
  | {
      /**
       * A custom amount to approve as the trigger
       * @example 1000000n // 1 USDC (6 decimals)
       */
      approvalAmount?: bigint
      /**
       * The amount of the token to use, in the token's smallest unit.
       * @example 1000000n // 1 USDC (6 decimals)
       */
      amount: bigint
    }
>

export type Trigger = OneOf<TokenTrigger | CustomTrigger>

/**
 * Parameters for signing a permit quote
 */
export type SignPermitQuoteParams = {
  /**
   * The quote to sign
   * @see {@link GetPermitQuotePayload}
   */
  fusionQuote: GetPermitQuotePayload
  /**
   * Optional companion smart account to execute the superTxn
   * If not provided, uses the client's default account
   */
  companionAccount?: MultichainSmartAccount
}

/**
 * Response payload containing the signed permit quote
 */
export type SignPermitQuotePayload = GetQuotePayload & {
  /**
   * The signature of the quote, prefixed with '0x177eee02' and concatenated with
   * the encoded permit parameters and signature components
   */
  signature: Hex
}

const PERMIT_PREFIX = "0x177eee02"

export const prepareSignablePermitQuotePayload = async (
  quoteParams: GetPermitQuotePayload,
  owner: Address,
  spender: Address,
  publicClient: PublicClient | WalletClient
): Promise<SignablePermitQuotePayload> => {
  const { quote, trigger } = quoteParams

  // Type guard to ensure we have a TokenTrigger
  if (trigger.call) {
    throw new Error("Custom triggers are not supported for permit quotes")
  }

  if (!trigger.amount)
    throw new Error("Amount is required to sign a permit quote")

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

  const token = getContract({
    abi: TokenWithPermitAbi,
    address: trigger.tokenAddress,
    client: publicClient
  })

  const values = await Promise.allSettled([
    token.read.nonces([owner]),
    token.read.name(),
    token.read.version(),
    token.read.DOMAIN_SEPARATOR()
  ])

  const [nonce, name, version, domainSeparator] = values.map((value, i) => {
    const key = ["nonce", "name", "version", "domainSeparator"][i]
    if (value.status === "fulfilled") {
      return value.value
    }
    if (value.status === "rejected" && key === "version") {
      return "1"
    }
    throw new Error(`Failed to get value: ${value.reason}`)
  }) as [bigint, string, string, `0x${string}`]

  const signablePermitQuotePayload = {
    domain: {
      name,
      version,
      chainId: trigger.chainId,
      verifyingContract: trigger.tokenAddress
    },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    },
    primaryType: "Permit",
    message: {
      owner: owner,
      spender: spender,
      value: amount,
      nonce,
      deadline: BigInt(quote.hash)
    }
  }

  return {
    signablePayload: signablePermitQuotePayload,
    metadata: {
      nonce,
      name,
      version,
      domainSeparator,
      owner,
      spender,
      amount
    }
  }
}

export const formatSignedPermitQuotePayload = (
  quoteParams: GetPermitQuotePayload,
  metadata: PermitMetadata,
  signature: Hex
): SignPermitQuotePayload => {
  const { quote, trigger } = quoteParams

  const sigComponents = parseSignature(signature)

  const encodedSignature = encodeAbiParameters(
    [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "domainSeparator", type: "bytes32" },
      { name: "permitTypehash", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "chainId", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "v", type: "uint256" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" }
    ],
    [
      trigger.tokenAddress!,
      metadata.spender,
      metadata.domainSeparator,
      PERMIT_TYPEHASH,
      metadata.amount,
      BigInt(trigger.chainId),
      metadata.nonce,
      sigComponents.v!,
      sigComponents.r,
      sigComponents.s
    ]
  )

  return { ...quote, signature: concatHex([PERMIT_PREFIX, encodedSignature]) }
}

/**
 * Signs a permit quote using EIP-2612 permit signatures. This enables gasless
 * approvals for ERC20 tokens that implement the permit extension.
 *
 * @param client - The Mee client instance
 * @param parameters - Parameters for signing the permit quote
 * @param parameters.fusionQuote - The permit quote to sign
 * @param [parameters.account] - Optional account to use for signing
 *
 * @returns Promise resolving to the quote payload with permit signature
 *
 * @example
 * ```typescript
 * const signedPermitQuote = await signPermitQuote(meeClient, {
 *   fusionQuote: {
 *     quote: quotePayload,
 *     trigger: {
 *       tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *       chainId: 1,
 *       amount: 1000000n // 1 USDC
 *     }
 *   },
 *   account: smartAccount // Optional
 * });
 * ```
 */
export const signPermitQuote = async (
  client: BaseMeeClient,
  parameters: SignPermitQuoteParams
): Promise<SignPermitQuotePayload> => {
  const {
    companionAccount: account_ = client.account,
    fusionQuote: { trigger }
  } = parameters

  const signer = account_.signer

  const { walletClient, address: spender } = account_.deploymentOn(
    trigger.chainId,
    true
  )

  const owner = signer.address

  const { signablePayload, metadata } = await prepareSignablePermitQuotePayload(
    parameters.fusionQuote,
    owner,
    spender,
    walletClient
  )

  const signature = await walletClient.signTypedData({
    ...signablePayload,
    account: walletClient.account!
  })

  return formatSignedPermitQuotePayload(
    parameters.fusionQuote,
    metadata,
    signature
  )
}

export default signPermitQuote
