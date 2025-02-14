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
   * Amount of the token to use, in the token's smallest unit
   * @example 1000000n // 1 USDC (6 decimals)
   */
  amount: bigint
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
   * The signature of the quote, prefixed with '0x02' and concatenated with
   * the encoded permit parameters and signature components
   */
  signature: Hex
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
    account: account_ = client.account,
    fusionQuote: { quote, trigger }
  } = parameters

  const signer = account_.signer

  const { walletClient } = account_.deploymentOn(trigger.chainId, true)
  const owner = signer.address
  const spender = quote.paymentInfo.sender

  const token = getContract({
    abi: TokenWithPermitAbi,
    address: trigger.tokenAddress,
    client: walletClient
  })

  const [nonce, name, version, domainSeparator] = await Promise.all([
    token.read.nonces([owner]),
    token.read.name(),
    token.read.version(),
    token.read.DOMAIN_SEPARATOR()
  ])

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

  return {
    ...quote,
    signature: concatHex(["0x02", encodedSignature])
  }
}

export default signPermitQuote
