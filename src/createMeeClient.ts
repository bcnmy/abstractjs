import type { Prettify } from "viem"
import type { MultichainSmartAccount } from "./account-vendors/account"
import createHttpClient, {
  type HttpClient,
  type HttpClientParams
} from "./utils/clients/createHttpClient"
import { meeActions } from "./decorators"

/**
 * Default URL for the MEE node service
 */
const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io"

/**
 * Parameters for creating a Mee client
 */
export type CreateMeeClientParams = {
  /** URL for the MEE node service */
  url?: HttpClientParams
  /** Polling interval for the Mee client */
  pollingInterval?: number
  /** Account to use for the Mee client */
  account: MultichainSmartAccount
}

export type BaseMeeClient = Prettify<
  HttpClient & {
    pollingInterval: number
    account: MultichainSmartAccount
  }
>

export type MeeClient = ReturnType<typeof createMeeClient>

export const createMeeClient = (params: CreateMeeClientParams) => {
  console.warn(`
--------------------------- READ ----------------------------------------------
  You are using the Developer Preview of the Biconomy MEE. The underlying 
  contracts are still being audited, and the multichain tokens exported from 
  this package are yet to be verified.
-------------------------------------------------------------------------------`)
  const { url = DEFAULT_MEE_NODE_URL, pollingInterval, account } = params
  const httpClient = createHttpClient(url)
  const baseMeeClient = Object.assign(httpClient, {
    pollingInterval,
    account
  })

  return baseMeeClient.extend(meeActions)
}
