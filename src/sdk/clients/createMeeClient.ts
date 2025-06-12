import type { Address, Prettify } from "viem"
import type { MultichainSmartAccount } from "../account/toMultiChainNexusAccount"
import { isStaging } from "../account/utils/Helpers"
import createHttpClient, { type HttpClient, type Url } from "./createHttpClient"
import { type GetInfoPayload, getInfo, meeActions } from "./decorators/mee"

export const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io/v3"
/**
  const STAKEPOOL_MEE_NODE_URL = "https://mainnet.mee.stakepool.dev.br/v3"
*/
/**
 * Default URL for the MEE node service
 */
export const DEFAULT_PATHFINDER_URL = "https://network.biconomy.io/v1"
const DEFAULT_PATHFINDER_API_KEY = "mee_3ZZmXCSod4xVXDRCZ5k5LTHg"

export const DEFAULT_STAGING_PATHFINDER_URL =
  "https://staging-network.biconomy.io/v1"
const DEFAULT_STAGING_PATHFINDER_API_KEY = "mee_3ZhZhHx3hmKrBQxacr283dHt"

/**
 * Constants for sponshorshipxw
 */

// Sponsorship Nexus Account Address
export const DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT: Address =
  "0x18eAc826f3dD77d065E75E285d3456B751AC80d5"
// Base
export const DEFAULT_MEE_SPONSORSHIP_CHAIN_ID = 8453
// USDC
export const DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS: Address =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

// Sponsorship Nexus Account Address
export const DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT: Address =
  "0x18eAc826f3dD77d065E75E285d3456B751AC80d5"
// Base Sepolia
export const DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID = 84532
// USDC
export const DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS: Address =
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e"

/**
 * Parameters for creating a Mee client
 */
export type CreateMeeClientParams = {
  /** URL for the MEE node service */
  url?: Url
  /** Polling interval for the Mee client */
  pollingInterval?: number
  /** Account to use for the Mee client */
  account: MultichainSmartAccount
  /** Auth key for the Mee client */
  apiKey?: string
}

export type BaseMeeClient = Prettify<
  HttpClient & {
    pollingInterval: number
    account: MultichainSmartAccount
    info: GetInfoPayload
  }
>

export type MeeClient = Awaited<ReturnType<typeof createMeeClient>>

export const createMeeClient = async (params: CreateMeeClientParams) => {
  const {
    account,
    pollingInterval = 1000,
    url = isStaging() ? DEFAULT_STAGING_PATHFINDER_URL : DEFAULT_PATHFINDER_URL,
    apiKey = isStaging()
      ? DEFAULT_STAGING_PATHFINDER_API_KEY
      : DEFAULT_PATHFINDER_API_KEY
  } = params

  const httpClient = createHttpClient(url, apiKey)
  const info = await getInfo(httpClient)
  const baseMeeClient = Object.assign(httpClient, {
    pollingInterval,
    account,
    info
  })

  // Check if the account is supported by the MEE node. Throws if not.
  const supportedChains = info.supportedChains.map(({ chainId }) =>
    Number(chainId)
  )
  const supported = account.deployments.every(({ chain }) =>
    supportedChains.includes(chain.id)
  )

  if (!supported) {
    throw new Error(
      `Some account chains are not supported by the MEE node. Please check the supported chains and try again. ${supportedChains.join(
        ", "
      )}`
    )
  }

  return baseMeeClient.extend(meeActions)
}
