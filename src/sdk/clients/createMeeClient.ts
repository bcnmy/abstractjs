import type { Prettify } from "viem"
import type { MultichainSmartAccount } from "../account/toMultiChainNexusAccount"
import { isStaging } from "../account/utils/Helpers"
import { inProduction } from "../account/utils/Utils"
import createHttpClient, { type HttpClient, type Url } from "./createHttpClient"
import { type GetInfoPayload, getInfo, meeActions } from "./decorators/mee"

export const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io/v3"
/**
  const STAKEPOOL_MEE_NODE_URL = "https://mainnet.mee.stakepool.dev.br/v3"
*/
/**
 * Default URL for the MEE node service
 */
const DEFAULT_PATHFINDER_URL = "https://network.biconomy.io/v1"
const DEFAULT_PATHFINDER_API_KEY = "mee_3ZZmXCSod4xVXDRCZ5k5LTHg"

const DEFAULT_STAGING_PATHFINDER_URL = "https://staging-network.biconomy.io/v1"
const DEFAULT_STAGING_PATHFINDER_API_KEY = "mee_3ZhZhHx3hmKrBQxacr283dHt"

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
  inProduction() &&
    console.warn(`
--------------------------- READ ----------------------------------------------
  You are using the Developer Preview of the Biconomy MEE. The underlying 
  contracts are still being audited, and the multichain tokens exported from 
  this package are yet to be verified.
-------------------------------------------------------------------------------`)
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
