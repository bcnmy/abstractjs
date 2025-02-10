import {
  http,
  type BundlerRpcSchema,
  type Chain,
  type Client,
  type OneOf,
  type Prettify,
  type RpcSchema,
  type Transport
} from "viem"
import {
  type BundlerActions,
  type BundlerClientConfig,
  createBundlerClient
} from "viem/account-abstraction"
import type { AnyData, ModularSmartAccount } from "../modules/utils/Types"
import {
  type PaymasterContext,
  biconomySponsoredPaymasterContext
} from "./createBicoPaymasterClient"
import { type BicoActions, bicoBundlerActions } from "./decorators/bundler"
import { getGasFeeValues } from "./decorators/bundler/getGasFeeValues"
import { type Erc7579Actions, erc7579Actions } from "./decorators/erc7579"
import {
  type SmartAccountActions,
  smartAccountActions
} from "./decorators/smartAccount"

/**
 * Nexus Client type
 */
export type NexusClient<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  account extends ModularSmartAccount | undefined =
    | ModularSmartAccount
    | undefined,
  client extends Client | undefined = Client | undefined,
  rpcSchema extends RpcSchema | undefined = undefined
> = Prettify<
  Client<
    transport,
    chain extends Chain
      ? chain
      : client extends Client<AnyData, infer chain>
        ? chain
        : undefined,
    account,
    rpcSchema extends RpcSchema
      ? [...BundlerRpcSchema, ...rpcSchema]
      : BundlerRpcSchema,
    BundlerActions<account>
  >
> &
  BundlerActions<ModularSmartAccount> &
  BicoActions &
  Erc7579Actions<ModularSmartAccount> &
  SmartAccountActions<chain, ModularSmartAccount> & {
    /**
     * The Nexus account associated with this client
     */
    account: ModularSmartAccount
    /**
     * Optional client for additional functionality
     */
    client?: client | Client | undefined
    /**
     * Optional paymaster configuration
     */
    paymaster?: BundlerClientConfig["paymaster"] | undefined
    /**
     * Optional paymaster context
     */
    paymasterContext?: PaymasterContext | undefined
    /**
     * Optional user operation configuration
     */
    userOperation?: BundlerClientConfig["userOperation"] | undefined
  }

type BicoBundlerClientConfig = Omit<BundlerClientConfig, "transport"> &
  OneOf<
    | {
        transport: Transport
      }
    | {
        bundlerUrl: string
      }
    | {
        apiKey?: string
      }
  >

/**
 * Creates a Bico Bundler Client with a given Transport configured for a Chain.
 *
 * @param parameters - Configuration for the Bico Bundler Client
 * @returns A Bico Bundler Client
 *
 * @example
 * import { createBicoBundlerClient, http } from '@biconomy/abstractjs'
 * import { mainnet } from 'viem/chains'
 *
 * const bundlerClient = createBicoBundlerClient({ chain: mainnet });
 */
export const createBicoBundlerClient = (
  parameters: BicoBundlerClientConfig
) => {
  if (
    !parameters.apiKey &&
    !parameters.bundlerUrl &&
    !parameters.transport &&
    !parameters?.chain
  ) {
    throw new Error(
      "Cannot set determine a bundler url, please provide a chain."
    )
  }

  const defaultedTransport = parameters.transport
    ? parameters.transport
    : parameters.bundlerUrl
      ? http(parameters.bundlerUrl)
      : http(
          // @ts-ignore: Type saftey provided by the if statement above
          `https://bundler.biconomy.io/api/v3/${parameters.chain.id}/${
            parameters.apiKey ??
            "nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f14"
          }`
        )

  const defaultedPaymasterContext = parameters.paymaster
    ? parameters.paymasterContext ?? biconomySponsoredPaymasterContext
    : undefined

  const defaultedUserOperation = parameters.userOperation ?? {
    estimateFeesPerGas: async ({ bundlerClient }) => {
      return (await getGasFeeValues(bundlerClient)).fast
    }
  }

  const bundler_ = createBundlerClient({
    ...parameters,
    transport: defaultedTransport,
    paymasterContext: defaultedPaymasterContext,
    userOperation: defaultedUserOperation
  })
    .extend(bicoBundlerActions())
    .extend(erc7579Actions())
    .extend(smartAccountActions())

  return bundler_ as unknown as NexusClient
}

// Aliases for backwards compatibility
export const createSmartAccountClient = createBicoBundlerClient
export const createNexusClient = createSmartAccountClient
export const createNexusSessionClient = createSmartAccountClient
export type BicoBundlerClient = NexusClient
