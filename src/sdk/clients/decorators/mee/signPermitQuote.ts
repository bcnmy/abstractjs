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
import type { EIP712DomainReturn } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { PERMIT_TYPEHASH } from "../../../constants"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { AbstractCall, GetQuotePayload } from "./getQuote"

/**
 * Represents the payload for a signable permit quote, omitting the "account" field from SignTypedDataParameters.
 * This type is used for EIP-712 signing of permit quotes by pure or custom signers.
 */
export type SignablePermitPayload = Omit<SignTypedDataParameters, "account">

/**
 * Metadata required for signing a permit quote.
 * This includes all necessary EIP-2612 domain and permit parameters,
 * as well as the computed domain separator and involved addresses.
 */
export interface PermitMetadata {
  nonce: bigint
  name: string
  version: string
  domainSeparator: Hex
  owner: Address
  spender: Address
  amount: bigint
}

/**
 * The payload structure for a signable permit quote.
 * Contains the EIP-712 signable payload and associated metadata
 * needed for formatting and encoding the final permit signature.
 */
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

/**
 * Prepares the payload required for signing a permit quote.
 * This function validates the trigger, fetches necessary token data (nonce, name, version, domain separator),
 * and constructs the EIP-712 signable payload for an ERC20 permit signature.
 * The returned object contains the signable payload and metadata required for formatting the final signed quote.
 *
 * @param quoteParams - The permit quote parameters, including the quote and trigger
 * @param owner - The address of the token owner (signer)
 * @param spender - The address that will be approved to spend the tokens
 * @param publicClient - The public or wallet client to interact with the token contract
 * @returns Promise resolving to an object containing the signable payload and metadata
 *
 * @example
 * ```typescript
 * const { signablePayload, metadata } = await prepareSignablePermitQuotePayload(
 *   fusionQuote,
 *   ownerAddress,
 *   spenderAddress,
 *   publicClient
 * );
 * // signablePayload: EIP-712 structured data for permit
 * // metadata: { nonce, name, version, domainSeparator, owner, spender, amount }
 * ```
 */
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

  // Check if we have an explicit `approvalAmount` set and error if it's smaller than the trigger amount
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

  // Fetch required token data for EIP-712 domain and permit
  const values = await Promise.allSettled([
    token.read.nonces([owner]),
    token.read.name(),
    token.read.version(),
    token.read.DOMAIN_SEPARATOR(),
    token.read.eip712Domain()
  ])

  const [nonce, name, version, domainSeparator, eip712Domain] = values.map(
    (value, i) => {
      const key = [
        "nonce",
        "name",
        "version",
        "domainSeparator",
        "eip712Domain"
      ][i]
      if (value.status === "fulfilled") {
        return value.value
      }
      if (value.status === "rejected") {
        if (key === "nonce") {
          // Tokens must implement the nonces function, otherwise we throw a error here
          throw new Error(
            "Permit signing failed: Token does not implement nonces(). This function is required for EIP-2612 compliance."
          )
        }

        if (key === "domainSeparator") {
          // Tokens must implement the domainSeparator function, otherwise we throw a error here
          throw new Error(
            "Permit signing failed: Token does not implement DOMAIN_SEPARATOR(). This function is required for EIP-712 domain separation."
          )
        }

        if (key === "name" || key === "version") {
          // Some tokens do not implement name and version; defaults to undefined
          return undefined
        }

        if (key === "eip712Domain") {
          // Some tokens do not implement eip712Domain; default to []
          return []
        }
      }

      // Fallback return value instead of throwing error
      return undefined
    }
  ) as [bigint, string, string, Hex, EIP712DomainReturn]

  const [, name_, version_] = eip712Domain

  // Default version will be used as fallback
  const defaultVersion = "1"

  if (version && version_) {
    if (version !== version_)
      console.warn(
        "Warning: Mismatch between token version() and eip712Domain().version. This may cause permit signature verification to fail."
      )
  }

  if (name && name_) {
    if (name !== name_)
      console.warn(
        "Warning: Mismatch between token name() and eip712Domain().name. This may cause permit signature verification to fail."
      )
  }

  if (!name && !name_) {
    throw new Error(
      "Permit signing failed: Token name is missing. Neither name() nor eip712Domain().name is available."
    )
  }

  const signablePermitQuotePayload = {
    domain: {
      name: name_ || name, // name from eip712Domain is mostly safe and more priority is given
      version: version_ || version || defaultVersion, // version from eip712Domain is mostly safe and more priority is given
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
      name: name_ || name,
      version: version_ || version || defaultVersion,
      domainSeparator,
      owner,
      spender,
      amount
    }
  }
}

/**
 * Formats the signed permit quote payload by encoding the signature and permit parameters,
 * and attaching the result to the original quote. The signature is prefixed and concatenated
 * as required by the MEE service for permit quotes.
 * Metadata is used to provide the necessary context for encoding.
 *
 * @param quoteParams - The original permit quote parameters
 * @param metadata - Metadata returned from prepareSignablePermitQuotePayload
 * @param signature - The EIP-712 signature to attach to the quote
 * @returns The signed permit quote payload with the signature field
 *
 * @example
 * ```typescript
 * const signedPermitQuote = formatSignedPermitQuotePayload(
 *   fusionQuote,
 *   metadata,
 *   signature
 * );
 * // signedPermitQuote: { ...quote, signature: '0x177eee02<encodedPermitSignature>' }
 * ```
 */
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
