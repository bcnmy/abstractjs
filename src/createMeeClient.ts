import type { Prettify } from "viem"
import type { MultichainSmartAccount } from "./account-vendors/account"

/**
 * Default URL for the MEE node service
 */
const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io"

/**
 * Parameters for initializing a MEE client
 */
type ClientParams = {
  /** Smart account instance to be used by the client */
  account: MultichainSmartAccount
  /** MEE node URL. Defaults to DEFAULT_MEE_NODE_URL */
  url?: `https://${string}` | `http://${string}`
  /** Interval in milliseconds for polling operations. Defaults to 1000 */
  pollingInterval?: number
}

/**
 * Parameters for making requests to the MEE node
 */
type RequestParams = {
  /** API endpoint path */
  path: string
  /** HTTP method to use. Defaults to "POST" */
  method?: "GET" | "POST"
  /** Optional request body */
  body?: object
}

/**
 * Base interface for the MEE client
 */
export type BaseMeeClient = {
  /** Makes HTTP requests to the MEE node */
  request: <T>(params: RequestParams) => Promise<T>
  /** Associated smart account instance */
  account: MultichainSmartAccount
  /** Polling interval in milliseconds */
  pollingInterval: number
  /**
   * Extends the client with additional functionality
   * @param fn - Function that adds new properties/methods to the base client
   * @returns Extended client with both base and new functionality
   */
  extend: <const client extends Extended>(
    fn: (base: BaseMeeClient) => client
  ) => client & BaseMeeClient
}

type Extended = Prettify<
  // disallow redefining base properties
  { [_ in keyof BaseMeeClient]?: undefined } & {
    [key: string]: unknown
  }
>

/**
 * Creates a new MEE client instance
 * @param params - Configuration parameters for the client
 * @returns A base MEE client instance that can be extended with additional functionality
 */
export const createMeeClient = (params: ClientParams): BaseMeeClient => {
  const { account, url = DEFAULT_MEE_NODE_URL, pollingInterval = 1000 } = params

  const request = async <T>(params: RequestParams) => {
    const { path, method = "POST", body } = params
    const result = await fetch(`${url}/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    })

    if (!result.ok) {
      throw new Error(result.statusText)
    }

    return (await result.json()) as T
  }

  const client = {
    request,
    account,
    pollingInterval
  }

  function extend(base: typeof client) {
    type ExtendFn = (base: typeof client) => unknown
    return (extendFn: ExtendFn) => {
      const extended = extendFn(base) as Extended
      for (const key in client) delete extended[key]
      const combined = { ...base, ...extended }
      return Object.assign(combined, { extend: extend(combined as any) })
    }
  }

  return Object.assign(client, { extend: extend(client) as any })
}

export default createMeeClient
