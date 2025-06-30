import { CHAIN_ID, DELEGATOR_CONTRACTS } from "@metamask/delegation-deployments"
import {
  type MetaMaskSmartAccount,
  createCaveatBuilder,
  createOpenDelegation
} from "@metamask/delegation-toolkit"
import {
  type Hex,
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  erc20Abi
} from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { GetQuotePayload } from "./getQuote"

/**
 * Parameters for signing a permit quote
 */
export type SignMmDtkQuoteParams = {
  /**
   * The quote to sign
   * @see {@link GetPermitQuotePayload}
   */
  fusionQuote: GetPermitQuotePayload
  /**
   * The MetaMask smart account to use for signing
   * the delegation
   */
  delegatorSmartAccount: MetaMaskSmartAccount
  /**
   * Optional companion smart account to execute the superTxn
   * If not provided, uses the client's default account
   */
  companionAccount?: MultichainSmartAccount
}

/**
 * Response payload containing the signed permit quote
 */
export type SignMmDtkQuotePayload = GetQuotePayload & {
  /**
   * The signature of the quote, prefixed with '0x177eee02' and concatenated with
   * the encoded permit parameters and signature components
   */
  signature: Hex
}

const MM_DTK_PREFIX = "0x177eee03"

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
 * const signedMMDtkQuote = await signMMDtkQuote(meeClient, {
 *   fusionQuote: {
 *     quote: quotePayload,
 *     trigger: {
 *       tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
 *       chainId: 1,
 *       amount: 1000000n // 1 USDC
 *     }
 *   },
 *   delegatorSmartAccount: mmDtkAccount
 * });
 * ```
 */
export const signMMDtkQuote = async (
  client: BaseMeeClient,
  parameters: SignMmDtkQuoteParams
): Promise<SignMmDtkQuotePayload> => {
  const {
    companionAccount: account_ = client.account,
    delegatorSmartAccount,
    fusionQuote: { quote, trigger }
  } = parameters

  if (trigger.call) {
    throw new Error("Custom triggers are not supported for fusion transactions")
  }

  if (!trigger.amount)
    throw new Error("Amount is required to sign a MM DTK quote")

  // prepare the delegation to sign
  const environment = delegatorSmartAccount.environment
  const caveatBuilder = createCaveatBuilder(environment)

  const approvedCallData = concatHex([
    encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [
        account_.addressOn(trigger.chainId, true), // spender
        trigger.amount // amount
      ]
    }),
    quote.hash // SuperTxn Hash
  ])

  const caveats = caveatBuilder.addCaveat("exactExecution", {
    target: trigger.tokenAddress,
    value: 0n, // 0 ETH
    callData: approvedCallData
  })

  const openRootDelegation = createOpenDelegation({
    from: delegatorSmartAccount.address,
    caveats
  })

  const signature = await delegatorSmartAccount.signDelegation({
    delegation: openRootDelegation
  })

  const delegationManager = getDelegationManager(trigger.chainId)

  const redeemDelegationErc7579ExecutionCalldata = encodePacked(
    ["address", "uint256", "bytes"],
    [trigger.tokenAddress, 0n, approvedCallData]
  )

  const encodedSignature = encodeAbiParameters(
    [
      { name: "delegationManager", type: "address" },
      {
        name: "delegation",
        type: "tuple",
        components: [
          { name: "delegate", type: "address" },
          { name: "delegator", type: "address" },
          { name: "authority", type: "bytes32" },
          {
            name: "caveats",
            type: "tuple[]",
            components: [
              { name: "enforcer", type: "address" },
              { name: "terms", type: "bytes" },
              { name: "args", type: "bytes" }
            ]
          },
          { name: "salt", type: "uint256" },
          { name: "signature", type: "bytes" }
        ]
      },
      { name: "redeemDelegationErc7579ExecutionCalldata", type: "bytes" }
    ],
    [
      delegationManager,
      {
        delegate: openRootDelegation.delegate,
        delegator: openRootDelegation.delegator,
        authority: openRootDelegation.authority,
        caveats: openRootDelegation.caveats.map((caveat) => ({
          enforcer: caveat.enforcer,
          terms: caveat.terms,
          args: caveat.args
        })),
        salt:
          openRootDelegation.salt === "0x"
            ? BigInt(0)
            : BigInt(openRootDelegation.salt),
        signature: signature
      },
      redeemDelegationErc7579ExecutionCalldata
    ]
  )

  return { ...quote, signature: concatHex([MM_DTK_PREFIX, encodedSignature]) }
}

export default signMMDtkQuote

const getDelegationManager = (chainId: number): `0x${string}` => {
  // Try to find the delegation manager in the latest version first (1.3.0)
  if (DELEGATOR_CONTRACTS["1.3.0"][chainId]?.DelegationManager) {
    return DELEGATOR_CONTRACTS["1.3.0"][chainId].DelegationManager
  }

  // Fallback to version 1.1.0
  if (DELEGATOR_CONTRACTS["1.1.0"][chainId]?.DelegationManager) {
    return DELEGATOR_CONTRACTS["1.1.0"][chainId].DelegationManager
  }

  // Fallback to version 1.0.0
  if (DELEGATOR_CONTRACTS["1.0.0"][chainId]?.DelegationManager) {
    return DELEGATOR_CONTRACTS["1.0.0"][chainId].DelegationManager
  }

  // If no delegation manager is found for the chainId, throw an error
  throw new Error(
    `No delegation manager found for chainId ${chainId}. Supported chains are: ${Object.values(
      CHAIN_ID
    ).join(", ")}`
  )
}
