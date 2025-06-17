import {
  type Chain,
  type Hex,
  type PublicClient,
  type Transport,
  createPublicClient
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { type NonceInfo, toMultichainNexusAccount } from "."
import type { Url } from "../clients/createHttpClient"
import { createMeeClient } from "../clients/createMeeClient"
import type { GetQuotePayload } from "../clients/decorators/mee"
import deployGasTank, {
  type DeployGasTankParams,
  type GasTankDeployPayload
} from "./decorators/deployGasTank"
import {
  type GetGasTankAddressPayload,
  getGasTankAddress as getGasTankAddressDecorator
} from "./decorators/getGasTankAddress"
import {
  type GetGasTankBalanceParams,
  type GetGasTankBalancePayload,
  getGasTankBalance as getGasTankBalanceDecorator
} from "./decorators/getGasTankBalance"
import { getGasTankNonce as getGasTankNonceDecorator } from "./decorators/getGasTankNonce"
import {
  type SponsorSupertransactionParams,
  sponsorSupertransaction as sponsorSupertransactionDecorator
} from "./decorators/sponsorSupertransaction"
import withdrawFromGasTank, {
  type WithdrawFromGasTankParams,
  type WithdrawFromGasTankPayload
} from "./decorators/withdrawFromGasTank"

/**
 * Parameters required to create a gas tank account
 */
export type GasTankAccountParams = {
  /** EOA account privateKey to create nexus instance */
  privateKey: Hex
  /** chain where the account to be used */
  chain: Chain
  /** Transport to use for the gas tank Account */
  transport: Transport
  /** Parameters for mee client */
  options?: {
    mee: {
      /** Mee node url. Default to biconomy network */
      url?: Url
      /** Mee API key. */
      apiKey?: string
    }
  }
}

/**
 * Represents a gas tank smart account
 */
export type GasTankAccount = {
  /**
   * Viem PublicClient for gas tank account
   * @returns Promise resolving to the gas tank public client
   */
  publicClient: PublicClient
  /**
   * Get a gas tank deployment status
   * @returns Promise resolving to the gas tank deployment status
   */
  isDeployed: () => Promise<boolean>
  /**
   * Get a gas tank address
   * @returns Promise resolving to the gas tank address
   */
  getAddress: () => Promise<GetGasTankAddressPayload>

  /**
   * Get a gas tank balance
   * @param params - Parameters for retrieving the gas tank balance
   * @returns Promise resolving to the gas tank balance
   */
  getBalance: (
    params: Pick<GetGasTankBalanceParams, "tokenAddress">
  ) => Promise<GetGasTankBalancePayload>

  /**
   * Get gas tank nonce
   * @param params - Parameters for retrieving the gas tank nonce
   * @returns Promise resolving to the gas tank nonce
   */
  getNonce: () => Promise<NonceInfo>

  /**
   * Sign the quote for sponsorship
   * @param params - Parameters for retrieving the signedSponsoredQuote
   * @returns Promise resolving to the sponsored quote
   */
  signSponsorship: (
    params: Pick<SponsorSupertransactionParams, "quote">
  ) => Promise<GetQuotePayload>

  /**
   * Deploy gas tank account
   * @param params - Parameters for deploying gas tank
   * @returns Promise resolving to the gas tank deployment
   */
  deploy: (
    params: Omit<DeployGasTankParams, "chainId" | "meeClient">
  ) => Promise<GasTankDeployPayload>

  /**
   * Withdraw funds from gasTank
   * @param params - Parameters to withdraw funds from gas tank
   * @returns Promise resolving to the gas tank withdrawal
   */
  withdraw: (
    params: Omit<WithdrawFromGasTankParams, "chainId" | "meeClient">
  ) => Promise<WithdrawFromGasTankPayload>
}

/**
 * Creates a gas tank account for sponsorship
 *
 * @param parameters - {@link GasTankAccountParams} Configuration for gas tank account
 * @param parameters.signer - The signer instance used for account
 * @param parameters.chain - chain for the gas tank account
 * @param parameters.privateKey - EOA private key for the gas tank account
 *
 * @returns Promise resolving to {@link GasTankAccount} instance
 *
 * @example
 * const account = await toGasTankAccount({
 *   privateKey: '0xprivate_key,
 *   chain: base,
 *   transport: http()
 * });
 */
export async function toGasTankAccount(
  params: GasTankAccountParams
): Promise<GasTankAccount> {
  const { transport, chain, privateKey, options } = params

  const mcNexus = await toMultichainNexusAccount({
    signer: privateKeyToAccount(privateKey),
    chains: [chain],
    transports: [transport]
  })

  const publicClient = createPublicClient({
    chain,
    transport
  })

  const meeClient = await createMeeClient({
    account: mcNexus,
    ...(options?.mee?.url ? { url: options.mee.url } : {}),
    ...(options?.mee?.apiKey ? { apiKey: options.mee.apiKey } : {})
  })

  const getAddress = () =>
    getGasTankAddressDecorator(mcNexus, { chainId: chain.id })

  const getBalance = (params: Pick<GetGasTankBalanceParams, "tokenAddress">) =>
    getGasTankBalanceDecorator(mcNexus, {
      chainId: chain.id,
      tokenAddress: params.tokenAddress
    })

  const signSponsorship = (
    params: Pick<SponsorSupertransactionParams, "quote">
  ) =>
    sponsorSupertransactionDecorator(mcNexus, {
      chainId: chain.id,
      quote: params.quote
    })

  const getNonce = () =>
    getGasTankNonceDecorator(mcNexus, { chainId: chain.id })

  const isDeployed = () => {
    return mcNexus.deploymentOn(chain.id, true).isDeployed()
  }

  const deploy = (params: Omit<DeployGasTankParams, "chainId" | "meeClient">) =>
    deployGasTank(mcNexus, {
      meeClient,
      chainId: chain.id,
      tokenAddress: params.tokenAddress,
      amount: params.amount,
      confirmations: params.confirmations || 2
    })

  const withdraw = (
    params: Omit<WithdrawFromGasTankParams, "chainId" | "meeClient">
  ) =>
    withdrawFromGasTank(mcNexus, {
      meeClient,
      chainId: chain.id,
      tokenAddress: params.tokenAddress,
      recipient: params.recipient,
      amount: params.amount,
      confirmations: params.confirmations || 2
    })

  return {
    publicClient,
    isDeployed,
    getAddress,
    getBalance,
    getNonce,
    signSponsorship,
    deploy,
    withdraw
  }
}
