import type { Chain, Hex, Transport } from "viem"
import type { Instruction } from "../clients/decorators/mee/getQuote"
import type { ModularSmartAccount } from "../modules/utils/Types"
import {
  type ToNexusSmartAccountParameters,
  toNexusAccount
} from "./toNexusAccount"
import type { Signer } from "./utils/toSigner"

import {
  type BuildComposableInstructionTypes,
  type BuildInstructionTypes,
  buildComposable as buildComposableDecorator,
  build as buildDecorator
} from "./decorators/build"
import {
  type BridgingInstructions,
  type MultichainBridgingParams,
  buildBridgeInstructions as buildBridgeInstructionsDecorator
} from "./decorators/buildBridgeInstructions"
import {
  type UnifiedERC20Balance,
  getUnifiedERC20Balance as getUnifiedERC20BalanceDecorator
} from "./decorators/getUnifiedERC20Balance"
import {
  type BridgeQueryResult,
  type QueryBridgeParams,
  queryBridge as queryBridgeDecorator
} from "./decorators/queryBridge"
import type { MultichainToken } from "./utils/Types"

/**
 * Parameters required to create a multichain Nexus account
 */
export type MultichainNexusParams = Partial<
  Omit<ToNexusSmartAccountParameters, "signer">
> & {
  /** Array of chains where the account will be deployed */
  chains: Chain[]
  /** Transport to use for the Nexus Account */
  transports: Transport[]
  /** The signer instance used for account creation */
  signer: ToNexusSmartAccountParameters["signer"]
}

/**
 * Represents a smart account deployed across multiple chains
 */
export type BaseMultichainSmartAccount = {
  /** Array of minimal MEE smart account instances across different chains */
  deployments: ModularSmartAccount[]
  /** The signer associated with this multichain account */
  signer: Signer
  /**
   * Function to retrieve deployment information for a specific chain
   * @param chainId - The ID of the chain to query
   * @param strictMode - Whether to throw an error if no deployment exists for the specified chain
   * @returns The smart account deployment for the specified chain
   * @throws Error if no deployment exists for the specified chain and strictMode is true
   */
  deploymentOn: {
    (chainId: number, strictMode: true): ModularSmartAccount
    (chainId: number, strictMode?: false): ModularSmartAccount | undefined
  }
  /**
   * Function to retrieve the address of the account on a specific chain
   * @param chainId - The ID of the chain to query
   * @param strictMode - Whether to throw an error if no deployment exists for the specified chain
   * @returns The address of the account on the specified chain
   * @throws Error if no deployment exists for the specified chain and strictMode is true
   */
  addressOn: {
    (chainId: number, strictMode: true): Hex
    (chainId: number, strictMode?: false): Hex | undefined
  }
}

export type MultichainSmartAccount = BaseMultichainSmartAccount & {
  /**
   * Function to retrieve the unified ERC20 balance across all deployments
   * @param mcToken - The multichain token to query
   * @returns The unified ERC20 balance across all deployments
   * @example
   * const balance = await mcAccount.getUnifiedERC20Balance(mcUSDC)
   */
  getUnifiedERC20Balance: (
    mcToken: MultichainToken
  ) => Promise<UnifiedERC20Balance>
  /**
   * Function to build instructions for bridging a token across all deployments
   * @param params - The parameters for the balance requirement
   * @returns Instructions for any required bridging operations
   * @example
   * const instructions = await mcAccount.build({
   *   amount: BigInt(1000),
   *   mcToken: mcUSDC,
   *   toChain: base
   * })
   */
  build: (
    params: BuildInstructionTypes,
    currentInstructions?: Instruction[]
  ) => Promise<Instruction[]>
  /**
   * Function to build composable instructions
   * @param params - The parameters for the composable instruction
   * @returns Returns composable instructions
   * @example
   * const instructions = await mcAccount.build({
   *   amount: BigInt(1000),
   *   mcToken: mcUSDC,
   *   toChain: base
   * })
   */
  buildComposable: (
    params: BuildComposableInstructionTypes,
    currentInstructions?: Instruction[]
  ) => Promise<Instruction[]>

  /**
   * Function to build instructions for bridging a token across all deployments
   * @param params - The parameters for the balance requirement
   * @returns Instructions for any required bridging operations
   * @example
   * const instructions = await mcAccount.buildBridgeInstructions({
   *   amount: BigInt(1000),
   *   mcToken: mcUSDC,
   *   toChain: base
   * })
   */
  buildBridgeInstructions: (
    params: Omit<MultichainBridgingParams, "account">
  ) => Promise<BridgingInstructions>
  /**
   * Function to query the bridge
   * @param params - The parameters for the bridge query
   * @returns The bridge query result
   * @example
   * const result = await mcAccount.queryBridge({
   *   amount: BigInt(1000),
   *   mcToken: mcUSDC,
   *   toChain: base
   * })
   */
  queryBridge: (params: QueryBridgeParams) => Promise<BridgeQueryResult | null>
}

/**
 * Creates a multichain Nexus account across specified chains
 *
 * @param parameters - {@link MultichainNexusParams} Configuration for multichain account creation
 * @param parameters.signer - The signer instance used for account creation
 * @param parameters.chains - Array of chains where the account will be deployed
 *
 * @returns Promise resolving to {@link MultichainSmartAccount} instance
 *
 * @throws Error if account creation fails on any chain
 *
 * @example
 * const account = await toMultichainNexusAccount({
 *   signer: mySigner,
 *   chains: [optimism, base],
 *   transports: [http(), http()]
 * });
 *
 * // Get deployment on specific chain
 * const optimismDeployment = account.deploymentOn(10);
 *
 * // Check token balance across chains
 * const balance = await account.getUnifiedERC20Balance(mcUSDC);
 *
 * // Build bridge transaction
 * const bridgeInstructions = await account.buildBridgeInstructions({
 *   amount: BigInt("1000000"), // 1 USDC
 *   mcToken: mcUSDC,
 *   toChain: base
 * });
 */
export async function toMultichainNexusAccount(
  multiChainNexusParams: MultichainNexusParams
): Promise<MultichainSmartAccount> {
  const {
    chains,
    signer: unresolvedSigner,
    transports,
    ...accountParameters
  } = multiChainNexusParams

  if (chains.length === 0) {
    throw new Error("No chains provided")
  }

  if (transports && transports.length !== chains.length) {
    throw new Error(
      "The number of transports must match the number of chains provided"
    )
  }

  const deployments = await Promise.all(
    chains.map((chain, i) =>
      toNexusAccount({
        chain,
        signer: unresolvedSigner,
        transport: transports[i],
        ...accountParameters
      })
    )
  )

  function deploymentOn(
    chainId: number,
    strictMode?: boolean
  ): ModularSmartAccount | undefined {
    const deployment = deployments.find(
      (dep) => dep.client.chain?.id === chainId
    )

    if (!deployment && strictMode) {
      throw new Error(`Deployment not found for chainId: ${chainId}`)
    }

    return deployment
  }

  function addressOn(chainId: number, strictMode: true) {
    const deployment = deploymentOn(chainId, strictMode)
    return deployment?.address
  }

  const baseAccount = {
    signer: deployments[0].signer, // This signer is resolved
    deployments,
    deploymentOn,
    addressOn
  } as BaseMultichainSmartAccount

  const getUnifiedERC20Balance = (mcToken: MultichainToken) =>
    getUnifiedERC20BalanceDecorator({ mcToken, account: baseAccount })

  const build = (
    params: BuildInstructionTypes,
    currentInstructions?: Instruction[]
  ): Promise<Instruction[]> =>
    buildDecorator({ currentInstructions, account: baseAccount }, params)

  const buildComposable = (
    params: BuildComposableInstructionTypes,
    currentInstructions?: Instruction[]
  ): Promise<Instruction[]> =>
    buildComposableDecorator(
      { currentInstructions, account: baseAccount },
      params
    )

  const buildBridgeInstructions = (
    params: Omit<MultichainBridgingParams, "account">
  ) => buildBridgeInstructionsDecorator({ ...params, account: baseAccount })

  const queryBridge = (params: QueryBridgeParams) =>
    queryBridgeDecorator({ ...params, account: baseAccount })

  return {
    ...baseAccount,
    getUnifiedERC20Balance,
    build,
    buildComposable,
    buildBridgeInstructions,
    queryBridge
  }
}
