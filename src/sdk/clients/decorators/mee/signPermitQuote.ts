import {
  type Address,
  type Hex,
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
import type { GetQuotePayload } from "./getQuote"

/**
 * Parameters for a token trigger
 */
export type Trigger = {
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
   * The amount of the token to use, in the token's smallest unit.
   * @example 1000000n // 1 USDC (6 decimals)
   */
  amount?: bigint
  /**
   * Whether to use max available funds from the EOA wallet to be pulled into SCA after fee deduction.
   * default is false
   */
  useMaxAvailableFunds?: true
}
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
   * Optional smart account to execute the transaction
   * If not provided, uses the client's default account
   */
  account?: MultichainSmartAccount
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
    account: account_ = client.account,
    fusionQuote: { quote, trigger }
  } = parameters

  const signer = account_.signer

  if (!trigger.amount)
    throw new Error("Amount is required to sign a permit quote")

  const { walletClient, address: spender } = account_.deploymentOn(
    trigger.chainId,
    true
  )
  const owner = signer.address

  const token = getContract({
    abi: TokenWithPermitAbi,
    address: trigger.tokenAddress,
    client: walletClient
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

  const signature = await walletClient.signTypedData({
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
      owner,
      spender: spender,
      value: trigger.amount,
      nonce,
      deadline: BigInt(quote.hash)
    },
    account: walletClient.account!
  })

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
      trigger.tokenAddress,
      spender,
      domainSeparator,
      PERMIT_TYPEHASH,
      trigger.amount,
      BigInt(trigger.chainId),
      nonce,
      sigComponents.v!,
      sigComponents.r,
      sigComponents.s
    ]
  )

  return { ...quote, signature: concatHex([PERMIT_PREFIX, encodedSignature]) }
}

export default signPermitQuote
