import {
  type Address,
  type Hex,
  type OneOf,
  type PublicClient,
  type SignTypedDataParameters,
  type WalletClient,
  concatHex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  parseSignature,
  toHex
} from "viem"
import { multicall } from "viem/actions"
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
export type SignablePermitQuotePayload = OneOf<
  | {
      fallbackToOnchainMode: true
    }
  | {
      signablePayload: SignablePermitPayload
      metadata: PermitMetadata
    }
>

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

export const isLegacyEIP712Domain = (
  name: string,
  version: string,
  verifyingContract: Address,
  salt: Hex,
  domainSeparator: Hex
) => {
  // Step 1: Hash the EIP712Domain type string
  const DOMAIN_TYPEHASH = keccak256(
    encodePacked(
      ["string"],
      [
        "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
      ]
    )
  )

  // Step 2: Hash the name
  const nameHash = keccak256(encodePacked(["string"], [name]))

  // Step 3: Hash the version
  const versionHash = keccak256(encodePacked(["string"], [version]))

  // Step 4: Encode and hash all parameters
  const DOMAIN_SEPARATOR = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, // EIP712_DOMAIN_TYPEHASH
        { type: "bytes32" }, // nameHash
        { type: "bytes32" }, // versionHash
        { type: "address" }, // verifyingContract
        { type: "bytes32" } // salt
      ],
      [DOMAIN_TYPEHASH, nameHash, versionHash, verifyingContract, salt]
    )
  )

  return domainSeparator.toLowerCase() === DOMAIN_SEPARATOR.toLowerCase()
}

export const isDefaultEIP712Domain = (
  name: string,
  version: string,
  chainId: number,
  verifyingContract: Address,
  domainSeparator: Hex
) => {
  // Step 1: Hash the EIP712Domain type string
  const DOMAIN_TYPEHASH = keccak256(
    encodePacked(
      ["string"],
      [
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
      ]
    )
  )

  // Step 2: Hash the name
  const nameHash = keccak256(encodePacked(["string"], [name]))

  // Step 3: Hash the version
  const versionHash = keccak256(encodePacked(["string"], [version]))

  // Step 4: Encode and hash all parameters
  const DOMAIN_SEPARATOR = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" }, // nameHash
        { type: "bytes32" }, // versionHash
        { type: "uint256" }, // chainId
        { type: "address" } // verifyingContract
      ],
      [
        DOMAIN_TYPEHASH,
        nameHash,
        versionHash,
        BigInt(chainId),
        verifyingContract
      ]
    )
  )

  return domainSeparator.toLowerCase() === DOMAIN_SEPARATOR.toLowerCase()
}

export const isDefaultEIP712DomainWithSalt = (
  name: string,
  version: string,
  chainId: number,
  verifyingContract: Address,
  salt: Hex,
  domainSeparator: Hex
) => {
  // Step 1: Hash the EIP712Domain type string
  const DOMAIN_TYPEHASH = keccak256(
    encodePacked(
      ["string"],
      [
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
      ]
    )
  )

  // Step 2: Hash the name
  const nameHash = keccak256(encodePacked(["string"], [name]))

  // Step 3: Hash the version
  const versionHash = keccak256(encodePacked(["string"], [version]))

  // Step 4: Encode and hash all parameters
  const DOMAIN_SEPARATOR = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, // EIP712_DOMAIN_TYPEHASH
        { type: "bytes32" }, // nameHash
        { type: "bytes32" }, // versionHash
        { type: "uint256" }, // chainId
        { type: "address" }, // verifyingContract
        { type: "bytes32" } // salt
      ],
      [
        DOMAIN_TYPEHASH,
        nameHash,
        versionHash,
        BigInt(chainId),
        verifyingContract,
        salt
      ]
    )
  )

  return domainSeparator.toLowerCase() === DOMAIN_SEPARATOR.toLowerCase()
}

export const getEIP712DomainType = (
  name: string,
  version: string,
  chainId: number,
  verifyingContract: Address,
  salt: Hex,
  domainSeparator: Hex
) => {
  try {
    const isValid = isLegacyEIP712Domain(
      name,
      version,
      verifyingContract,
      salt,
      domainSeparator
    )

    if (isValid) {
      return "legacy"
    }
  } catch {}

  try {
    const isValid = isDefaultEIP712Domain(
      name,
      version,
      chainId,
      verifyingContract,
      domainSeparator
    )

    if (isValid) {
      return "default"
    }
  } catch {}

  try {
    const isValid = isDefaultEIP712DomainWithSalt(
      name,
      version,
      chainId,
      verifyingContract,
      salt,
      domainSeparator
    )

    if (isValid) {
      return "default-with-salt"
    }
  } catch {}

  return "invalid"
}

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

  // If there is any error while prepare permit signature, the flow will fallback to onchain mode.
  // The fallbacks will happen for these errors such as, invalid permit values, domain separator mismatch, RPC issues and etc...
  try {
    // Fetch required token data for EIP-712 domain and permit using multicall
    const values = await multicall(publicClient, {
      contracts: [
        {
          address: trigger.tokenAddress,
          abi: TokenWithPermitAbi,
          functionName: "nonces",
          args: [owner]
        },
        {
          address: trigger.tokenAddress,
          abi: TokenWithPermitAbi,
          functionName: "name"
        },
        {
          address: trigger.tokenAddress,
          abi: TokenWithPermitAbi,
          functionName: "version"
        },
        {
          address: trigger.tokenAddress,
          abi: TokenWithPermitAbi,
          functionName: "DOMAIN_SEPARATOR"
        },
        {
          address: trigger.tokenAddress,
          abi: TokenWithPermitAbi,
          functionName: "eip712Domain"
        }
      ]
    })

    const [nonce, name, version, domainSeparator, eip712Domain] = values.map(
      (value, i) => {
        const key = [
          "nonce",
          "name",
          "version",
          "domainSeparator",
          "eip712Domain"
        ][i]
        if (value.status === "success") {
          return value.result
        }
        if (value.status === "failure") {
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

    const [, name_, version_, chainId_, verifyingContract_, salt_] =
      eip712Domain

    // Default version will be used as fallback
    const defaultVersion = "1"

    if (version?.length >= 0 && version_?.length >= 0) {
      if (version !== version_)
        console.warn(
          "Warning: Mismatch between token version() and eip712Domain().version. This may cause permit signature verification to fail."
        )
    }

    if (name?.length >= 0 && name_?.length >= 0) {
      if (name !== name_)
        console.warn(
          "Warning: Mismatch between token name() and eip712Domain().name. This may cause permit signature verification to fail."
        )
    }

    if (name === undefined && name_ === undefined) {
      throw new Error(
        "Permit signing failed: Token name is missing. Neither name() nor eip712Domain().name is available."
      )
    }

    // chainId from eip712Domain is mostly safe and more priority is given
    const permitChainId =
      chainId_ !== undefined ? Number(chainId_) : trigger.chainId

    const permitValues = {
      name: name_ ?? name, // name from eip712Domain is mostly safe and more priority is given
      version: version_ ?? version ?? defaultVersion, // version from eip712Domain is mostly safe and more priority is given
      chainId: permitChainId,
      verifyingContract: verifyingContract_ ?? trigger.tokenAddress, // verifyingContract from eip712Domain is mostly safe and more priority is given
      salt: salt_ ?? toHex(permitChainId, { size: 32 }), // salt from eip712Domain is mostly safe and more priority is given
      domainSeparator
    }

    const eip712DomainType = getEIP712DomainType(
      permitValues.name,
      permitValues.version,
      permitValues.chainId,
      permitValues.verifyingContract,
      permitValues.salt,
      permitValues.domainSeparator
    )

    const getDomain = (
      eip712DomainType: ReturnType<typeof getEIP712DomainType>
    ) => {
      switch (eip712DomainType) {
        case "default": {
          return {
            name: permitValues.name,
            version: permitValues.version,
            chainId: permitValues.chainId,
            verifyingContract: permitValues.verifyingContract
          }
        }
        case "default-with-salt": {
          return {
            name: permitValues.name,
            version: permitValues.version,
            chainId: permitValues.chainId,
            verifyingContract: permitValues.verifyingContract,
            salt: permitValues.salt
          }
        }
        case "legacy": {
          return {
            name: permitValues.name,
            version: permitValues.version,
            verifyingContract: permitValues.verifyingContract,
            salt: permitValues.salt
          }
        }
        default:
          throw new Error(
            "Permit signing failed: Domain separator mismatch, please double check the token's permit functionality"
          )
      }
    }

    const signablePermitQuotePayload = {
      domain: getDomain(eip712DomainType),
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

    const metadata: PermitMetadata = {
      nonce,
      name: permitValues.name,
      version: permitValues.version,
      domainSeparator: permitValues.domainSeparator,
      owner,
      spender,
      amount
    }

    return {
      signablePayload: signablePermitQuotePayload,
      metadata
    }
  } catch (error) {
    const errorMessage = (error as Error).message || "Permit siging failed"
    console.warn(errorMessage)
    console.info("Permit signing failed, fallback to onchain mode")

    return { fallbackToOnchainMode: true }
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
 * const { fallbackToOnchainMode, signedPermitQuotePayload } = await signPermitQuote(meeClient, {
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
): Promise<
  OneOf<
    | { signedPermitQuotePayload: SignPermitQuotePayload }
    | { fallbackToOnchainMode: true }
  >
> => {
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

  const { fallbackToOnchainMode, signablePayload, metadata } =
    await prepareSignablePermitQuotePayload(
      parameters.fusionQuote,
      owner,
      spender,
      walletClient
    )

  if (fallbackToOnchainMode) {
    return { fallbackToOnchainMode }
  }

  const signature = await walletClient.signTypedData({
    ...signablePayload,
    account: walletClient.account!
  })

  const signedPermitQuotePayload = formatSignedPermitQuotePayload(
    parameters.fusionQuote,
    metadata,
    signature
  )

  return { signedPermitQuotePayload }
}

export default signPermitQuote
