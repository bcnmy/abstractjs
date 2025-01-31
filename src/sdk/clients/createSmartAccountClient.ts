import type {
  Account,
  Address,
  BundlerRpcSchema,
  Chain,
  Client,
  ClientConfig,
  EstimateFeesPerGasReturnType,
  LocalAccount,
  OneOf,
  Prettify,
  RpcSchema,
  Transport,
  WalletClient
} from "viem"
import type {
  BundlerActions,
  BundlerClientConfig,
  PaymasterActions,
  SmartAccount,
  UserOperationRequest
} from "viem/account-abstraction"

import {
  type ToNexusSmartAccountParameters,
  toNexusAccount
} from "../account/toNexusAccount"
import type { EthersWallet } from "../account/utils/Utils"
import type { EthereumProvider } from "../account/utils/toSigner"
import {
  MAINNET_ADDRESS_K1_VALIDATOR_ADDRESS,
  MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
} from "../constants"
import type {
  AnyData,
  ModularSmartAccount,
  Module
} from "../modules/utils/Types"
import { createBicoBundlerClient } from "./createBicoBundlerClient"
import type { PaymasterContext } from "./createBicoPaymasterClient"
import type { BicoActions } from "./decorators/bundler"
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
     * Transport configuration for the bundler
     */
    bundlerTransport?: BundlerClientConfig["transport"]
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

/**
 * Configuration for creating a Smart account Client
 */
export type SmartAccountClientConfig<
  transport extends Transport = Transport,
  chain extends Chain | undefined = Chain | undefined,
  client extends Client | undefined = Client | undefined,
  rpcSchema extends RpcSchema | undefined = undefined
> = Prettify<
  Pick<
    ClientConfig<transport, chain, SmartAccount, rpcSchema>,
    | "account"
    | "cacheTime"
    | "chain"
    | "key"
    | "name"
    | "pollingInterval"
    | "rpcSchema"
  > & {
    /** RPC URL. */
    transport: transport
    /** Bundler URL. */
    bundlerTransport: transport
    /** Client that points to an Execution RPC URL. */
    client?: client | Client | undefined
    /** Paymaster configuration. */
    paymaster?:
      | true
      | {
          /** Retrieves paymaster-related User Operation properties to be used for sending the User Operation. */
          getPaymasterData?: PaymasterActions["getPaymasterData"] | undefined
          /** Retrieves paymaster-related User Operation properties to be used for gas estimation. */
          getPaymasterStubData?:
            | PaymasterActions["getPaymasterStubData"]
            | undefined
        }
      | undefined
    /** Paymaster context to pass to `getPaymasterData` and `getPaymasterStubData` calls. */
    paymasterContext?: PaymasterContext
    /** User Operation configuration. */
    userOperation?:
      | {
          /** Prepares fee properties for the User Operation request. */
          estimateFeesPerGas?:
            | ((parameters: {
                account: SmartAccount | undefined
                bundlerClient: Client
                userOperation: UserOperationRequest
              }) => Promise<EstimateFeesPerGasReturnType<"eip1559">>)
            | undefined
        }
      | undefined
    /** Owner of the account. */
    signer: OneOf<
      | EthereumProvider
      | WalletClient<Transport, Chain | undefined, Account>
      | LocalAccount
      | EthersWallet
    >
    /** Index of the account. */
    index?: bigint
    /** Active module of the account. */
    module?: Module
    /** Factory address of the account. */
    factoryAddress?: Address
    /** Owner module */
    validatorAddress?: Address
    /** Account address */
    accountAddress?: Address
    /** Attesters */
    attesters?: ToNexusSmartAccountParameters["attesters"]
    /** Threshold */
    attesterThreshold?: ToNexusSmartAccountParameters["attesterThreshold"]
    /** Boot strap address */
    bootStrapAddress?: Address
    /** Registry address */
    registryAddress?: Address
    /** Use test bundler */
    useTestBundler?: boolean
  }
>

/**
 * Creates a Nexus Client for interacting with the Nexus smart account system.
 *
 * @param parameters - {@link SmartAccountClientConfig}
 * @returns Nexus Client. {@link NexusClient}
 *
 * @example
 * import { createSmartAccountClient } from '@biconomy/abstractjs'
 * import { http } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const nexusClient = await createSmartAccountClient({
 *   chain: mainnet,
 *   transport: http('https://mainnet.infura.io/v3/YOUR-PROJECT-ID'),
 *   bundlerTransport: http('https://api.biconomy.io'),
 *   signer: '0x...',
 * })
 */
export async function createSmartAccountClient(
  parameters: SmartAccountClientConfig
): Promise<NexusClient> {
  const {
    account: account_,
    client: client_,
    chain = parameters.chain ?? client_?.chain,
    signer,
    index = 0n,
    key = "nexus client",
    name = "Nexus Client",
    module,
    factoryAddress = MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS,
    validatorAddress = MAINNET_ADDRESS_K1_VALIDATOR_ADDRESS,
    bundlerTransport,
    transport,
    accountAddress,
    paymasterContext,
    attesters,
    attesterThreshold,
    useTestBundler = false,
    ...bundlerConfig
  } = parameters

  if (!chain) throw new Error("Missing chain")

  const nexusAccount =
    account_ ??
    (await toNexusAccount({
      accountAddress,
      transport,
      chain,
      signer,
      index,
      module,
      factoryAddress,
      validatorAddress,
      attesters,
      attesterThreshold,
      useTestBundler
    }))

  const bundler_ = createBicoBundlerClient({
    ...bundlerConfig,
    chain,
    key,
    name,
    paymasterContext,
    account: nexusAccount,
    transport: bundlerTransport
  })
    .extend(erc7579Actions())
    .extend(smartAccountActions())

  return bundler_ as unknown as NexusClient
}

// Aliases for backwards compatibility
export const createNexusClient = createSmartAccountClient
export const createNexusSessionClient = createSmartAccountClient
