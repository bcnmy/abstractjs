import type { Prettify } from "viem"
import type { MultichainSmartAccount } from "../account/toMultiChainNexusAccount"
import { inProduction } from "../account/utils/Utils"
import createHttpClient, { type HttpClient, type Url } from "./createHttpClient"
import { type GetInfoPayload, getInfo, meeActions } from "./decorators/mee"

/**
 * Default URL for the MEE node service
 */
const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io"

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
  const { url = DEFAULT_MEE_NODE_URL, pollingInterval = 1000, account } = params
  const httpClient = createHttpClient(url)
  const info = await getInfo(httpClient)
  const baseMeeClient = Object.assign(httpClient, {
    pollingInterval,
    account,
    info
  })

  // Check if the account is supported by the MEE node. Throws if not.
  const supportedChains = info.supported_chains.map(({ chainId }) =>
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
