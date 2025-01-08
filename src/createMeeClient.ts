import type { Prettify } from "viem"
import type { MultichainSmartAccount } from "./account-vendors/account"

const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io"

type ClientParams = {
  account: MultichainSmartAccount
  url?: `https://${string}` | `http://${string}`
  pollingInterval?: number
}

type RequestParams = {
  path: string
  method?: "GET" | "POST"
  body?: object
}

export type BaseMeeClient = {
  request: <T>(params: RequestParams) => Promise<T>
  account: MultichainSmartAccount
  pollingInterval: number
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
