import {
  type Address,
  type Hex,
  type PartialBy,
  concatHex,
  encodeAbiParameters,
  getAddress,
  getContract,
  parseSignature
} from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { PERMIT_TYPEHASH } from "../../../constants"
import { TokenWithPermitAbi } from "../../../constants/abi/TokenWithPermitAbi"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetFusionQuotePayload } from "./getFusionQuote"

export type Trigger = {
  /** The address of the token to use on the relevant chain */
  address: Address
  /** The chainId to use */
  chainId: number
  /** Amount of the token to use */
  amount: bigint
}

export type SignFusionQuoteParams = {
  /** The quote to sign */
  quote: GetFusionQuotePayload
  /** Optional smart account to execute the transaction. If not provided, uses the client's default account */
  account?: MultichainSmartAccount
  /** The off-chain transaction to use as the trigger. This will default to information from the quote's paymentInfo */
  trigger: Trigger
}

export type SignPermitQuotePayload = GetFusionQuotePayload & {
  /** The signature of the quote */
  signature: Hex
}

/**
 * Signs a quote
 * @param client - The Mee client to use
 * @param params - The parameters for the quote
 * @returns The signed quote
 * @example
 * const signedPermitQuote = await signPermitQuote(meeClient, {
 *   quote: quotePayload,
 *   account: smartAccount
 * })
 */
export const signPermitQuote = async (
  client: BaseMeeClient,
  parameters: PartialBy<SignFusionQuoteParams, "trigger">
): Promise<SignPermitQuotePayload> => {
  const { account: account_ = client.account, quote, trigger } = parameters

  const {
    chainId = Number(quote.paymentInfo.chainId),
    address = getAddress(quote.paymentInfo.token),
    amount = BigInt(quote.paymentInfo.tokenWeiAmount)
  } = trigger ?? {}

  const signer = account_.signer
  const { walletClient } = account_.deploymentOn(chainId, true)
  const owner = signer.address
  const spender = quote.paymentInfo.sender

  const token = getContract({
    abi: TokenWithPermitAbi,
    address,
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
      chainId,
      verifyingContract: address
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
      value: amount,
      nonce,
      // this validates the stx
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
      address,
      spender,
      domainSeparator,
      PERMIT_TYPEHASH,
      amount,
      BigInt(chainId),
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
