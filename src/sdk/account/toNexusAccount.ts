import {
  type AbiParameter,
  type Account,
  type Address,
  type Chain,
  type ClientConfig,
  type GetEip712DomainReturnType,
  type Hex,
  type LocalAccount,
  type OneOf,
  type Prettify,
  type PublicClient,
  type RpcSchema,
  type SignableMessage,
  type Transport,
  type TypedData,
  type TypedDataDefinition,
  type UnionPartialBy,
  type WalletClient,
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  parseAbi,
  zeroAddress
} from "viem"
import {
  type SmartAccount,
  type SmartAccountImplementation,
  type UserOperation,
  entryPoint07Address,
  getUserOperationHash,
  toSmartAccount
} from "viem/account-abstraction"
import type { SignAuthorizationReturnType } from "viem/accounts"
import { getEip712Domain as getEip712DomainViemAction } from "viem/actions"
import type { MeeAuthorization } from "../clients/decorators/mee/getQuote"
import { ENTRY_POINT_ADDRESS, MEEVersion } from "../constants"
// Constants
import {
  COMPOSABILITY_MODULE_ABI_V1_0_0,
  COMPOSABILITY_MODULE_ABI_V1_1_0,
  EntrypointAbi
} from "../constants/abi"
import { toComposableExecutor, toComposableFallback } from "../modules"
import { toEmptyHook } from "../modules/toEmptyHook"
import {
  type ComposableCall,
  InputParamType
} from "../modules/utils/composabilityCalls"
import { toDefaultModule } from "../modules/validators/default/toDefaultModule"
import { toMeeK1Module } from "../modules/validators/meeK1/toMeeK1Module"
import type { Validator } from "../modules/validators/toValidator"
import {
  getFactoryData,
  getInitDataNoRegistry,
  getInitDataWithRegistry
} from "./decorators/getFactoryData"
import { getNexusAddress } from "./decorators/getNexusAddress"
import {
  getDefaultNonceKey,
  getNonceWithKeyUtil
} from "./decorators/getNonceWithKey"
import { toInitData } from "./utils"
import { EXECUTE_BATCH, EXECUTE_SINGLE } from "./utils/Constants"
// Utils
import type { Call } from "./utils/Types"
import {
  type EthersWallet,
  addressEquals,
  isNullOrUndefined,
  supportsCancun
} from "./utils/Utils"
import {
  type MEEVersionConfig,
  type NexusAccountId,
  isVersionOlder
} from "./utils/getVersion"
import { type EthereumProvider, type Signer, toSigner } from "./utils/toSigner"
import { toWalletClient } from "./utils/toWalletClient"

export type GetInitDataParams = {
  accountIndex: bigint
  defaultValidator: GenericModuleConfig
  prevalidationHooks: PrevalidationHookModuleConfig[]
  validators: GenericModuleConfig[]
  executors: GenericModuleConfig[]
  hook: GenericModuleConfig
  fallbacks: GenericModuleConfig[]
  customInitData?: Hex
}

/**
 * Base module configuration type
 */
export type MinimalModuleConfig = {
  module: Address
  data: Hex
}

/**
 * Generic module configuration type that can be extended with additional properties
 */
export type GenericModuleConfig<
  T extends MinimalModuleConfig = MinimalModuleConfig
> = T

export type PrevalidationHookModuleConfig = GenericModuleConfig & {
  hookType: bigint
}

/**
 * Parameters for chain configuration
 */
export type ChainConfiguration = {
  /** The blockchain network */
  chain: Chain
  /** The transport configuration */
  transport: ClientConfig["transport"]
  /** MEE version config */
  version: MEEVersionConfig
  /** Optional account address override */
  accountAddress?: Address
  /**
   * Flag to enable/disable MEE Version check. Defaults to true.
   * Only set this as false if you're very sure about MEE version support on specific chains otherwise SDK will
   * fail to detect the unavailability of version on certains which may result in weird error because of undeployed contracts
   */
  versionCheck?: boolean
}

/**
 * Parameters for creating a Nexus Smart Account
 */
export type ToNexusSmartAccountParameters = {
  /** The signer account or address */
  signer: OneOf<
    | EthereumProvider
    | WalletClient<Transport, Chain | undefined, Account>
    | LocalAccount
    | EthersWallet
  >
  /** Chain configuration */
  chainConfiguration: ChainConfiguration
  /** Optional index for the account */
  index?: bigint | undefined
  /** Optional validator modules configuration */
  validators?: Array<Validator>
  /** Optional executor modules configuration */
  executors?: Array<GenericModuleConfig>
  /** Optional prevalidation hook modules configuration */
  prevalidationHooks?: Array<PrevalidationHookModuleConfig>
  /** Optional hook module configuration */
  hook?: GenericModuleConfig
  /** Optional fallback modules configuration */
  fallbacks?: Array<GenericModuleConfig>
  /** Optional init data */
  initData?: Hex
} & Prettify<
  Pick<
    ClientConfig<Transport, Chain, Account, RpcSchema>,
    "account" | "cacheTime" | "key" | "name" | "pollingInterval" | "rpcSchema"
  >
>
/**
 * Nexus Smart Account type
 */
export type NexusAccount = Prettify<
  SmartAccount<NexusSmartAccountImplementation>
>

/**
 * NonceInfo type
 */
export type NonceInfo = {
  nonceKey: bigint
  nonce: bigint
}

/**
 * Delegation type
 * @param authorization - Custom authorization to use. Optional
 * @param delegatedContract - The contract address to delegate the authorization to. Defaults to the implementation address.
 * @param multiChain - Whether to use the multi-chain authorization. Defaults to false.
 */
export type DelegationParams = {
  delegatedContract?: Address
} & OneOf<
  | {
      authorization: SignAuthorizationReturnType
    }
  | {
      multiChain: boolean
    }
  | { chainId: number }
>

/**
 * UnDelegation type
 * @param authorization - Custom authorization to use. Optional
 */
export type UnDelegationParams = {
  authorization?: SignAuthorizationReturnType
}

/**
 * Nexus Smart Account Implementation
 */
export type NexusSmartAccountImplementation = SmartAccountImplementation<
  typeof EntrypointAbi,
  "0.7",
  {
    /** Gets the counterfactual address of the account */
    getAddress: () => Promise<Address>

    /** Gets the init code for the account */
    getInitCode: () => Hex

    /** Gets the nonce with key for the account */
    getNonceWithKey: (
      accountAddress: Address,
      parameters?: {
        key?: bigint
        validationMode?: "0x00" | "0x01" | "0x02"
        moduleAddress?: Address
      }
    ) => Promise<NonceInfo>

    /** Encodes a single call for execution */
    encodeExecute: (call: Call) => Promise<Hex>

    /** Encodes a batch of calls for execution */
    encodeExecuteBatch: (calls: readonly Call[]) => Promise<Hex>

    /** Encodes a composable call for execution */
    encodeExecuteComposable: (calls: ComposableCall[]) => Promise<Hex>

    /** Calculates the hash of a user operation */
    getUserOpHash: (userOp: UserOperation) => Hex

    /** Factory data used for account creation */
    factoryData: Hex

    /** Factory address used for account creation */
    factoryAddress: Address

    /** The signer instance */
    signer: Signer

    /** The public client instance */
    publicClient: PublicClient

    /** The wallet client instance */
    walletClient: WalletClient<Transport, Chain | undefined, Account, RpcSchema>

    /** The blockchain network */
    chain: Chain

    /** Get the active module */
    getModule: () => Validator

    /** Set the active module */
    setModule: (validationModule: Validator) => void

    /** Get authorization data for the EOA to Nexus Account
     * @param params - {@link DelegationParams}
     * @returns MeeAuthorization
     */
    toDelegation: (params?: DelegationParams) => Promise<MeeAuthorization>

    /** Execute the transaction to unauthorize the account
     * @param params - {@link UnDelegationParams}
     */
    unDelegate: (params?: UnDelegationParams) => Promise<Hex>

    /** Check if the account is delegated to the implementation address */
    isDelegated: () => Promise<boolean>

    /** Account ID */
    accountId: NexusAccountId

    /** Nexus version config */
    version: MEEVersionConfig

    /** EIP-712 domain for the account */
    getEip712Domain: () => Promise<GetEip712DomainReturnType>
  }
>

const prepareValidators = async (
  walletClient: WalletClient<Transport, Chain | undefined, Account, RpcSchema>,
  meeConfig: MEEVersionConfig,
  customValidators?: Validator[]
): Promise<Validator[]> => {
  let validators: Validator[] = []

  if (customValidators && customValidators.length > 0) {
    return customValidators
  }

  if (isVersionOlder(meeConfig.version, MEEVersion.V2_0_0)) {
    validators = [
      toMeeK1Module({
        walletClient,
        module: meeConfig.defaultValidatorAddress
      })
    ]
  } else {
    // No need to explicitly add validator for 1.2.X versions. default validator will be used which is
    // mee k1 validator
    validators = []
  }

  return validators
}

const prepareExecutors = (
  meeConfig: MEEVersionConfig,
  customExecutors?: GenericModuleConfig[]
): GenericModuleConfig[] => {
  let executors: GenericModuleConfig[] = []

  if (isVersionOlder(meeConfig.version, MEEVersion.V2_0_0)) {
    if (!meeConfig.composableModuleAddress) {
      throw new Error("Composable module address is missing")
    }

    // if using <=1.0.0, add the composable executor
    const composableExecutor = toComposableExecutor(
      meeConfig.composableModuleAddress
    )
    executors = [composableExecutor]

    for (const executor of customExecutors || []) {
      if (!addressEquals(executor.module, composableExecutor.module)) {
        executors.push(executor)
      }
    }
  } else {
    executors = customExecutors || []
  }

  return executors
}

const prepareFallbacks = (
  meeConfig: MEEVersionConfig,
  customFallbacks?: GenericModuleConfig[]
): GenericModuleConfig[] => {
  let fallbacks: GenericModuleConfig[] = []

  if (isVersionOlder(meeConfig.version, MEEVersion.V2_0_0)) {
    if (!meeConfig.composableModuleAddress) {
      throw new Error("Composable module address is missing")
    }

    // if nexus version <=1.0.0, add the composable fallback
    const composableFallback = toComposableFallback(
      meeConfig.composableModuleAddress
    )
    fallbacks = [composableFallback]

    for (const fallback of customFallbacks || []) {
      if (!addressEquals(fallback.module, composableFallback.module)) {
        fallbacks.push(fallback)
      }
    }
  } else {
    fallbacks = customFallbacks || []
  }

  return fallbacks
}

const prepareFactoryData = (
  meeConfig: MEEVersionConfig,
  initDataParams: GetInitDataParams
): { initData: Hex; factoryData: Hex } => {
  let factoryData: Hex = "0x"
  let initData: Hex = "0x"

  switch (meeConfig.version) {
    case MEEVersion.V1_0_0:
    case MEEVersion.V1_1_0: {
      if (!meeConfig.moduleRegistry) {
        throw new Error("Module registry not found in nexus config")
      }

      initData =
        initDataParams.customInitData ||
        getInitDataWithRegistry({
          bootStrapAddress: meeConfig.bootStrapAddress,
          validators: initDataParams.validators,
          registryAddress: meeConfig.moduleRegistry.registryAddress,
          attesters: meeConfig.moduleRegistry.attesters,
          attesterThreshold: meeConfig.moduleRegistry.attesterThreshold,
          meeVersion: meeConfig.version
        })

      factoryData = getFactoryData({
        initData,
        index: initDataParams.accountIndex
      })
      break
    }

    default: {
      // All the nexus version 1.2.x will be deployed with no registry
      initData =
        initDataParams.customInitData ||
        getInitDataNoRegistry({
          defaultValidator: initDataParams.defaultValidator,
          prevalidationHooks: initDataParams.prevalidationHooks,
          validators: initDataParams.validators,
          executors: initDataParams.executors,
          hook: initDataParams.hook,
          fallbacks: initDataParams.fallbacks,
          bootStrapAddress: meeConfig.bootStrapAddress
        })

      factoryData = getFactoryData({
        initData,
        index: initDataParams.accountIndex
      })
      break
    }
  }

  return { initData, factoryData }
}

/**
 * @description Create a Nexus Smart Account.
 *
 * @param parameters - {@link ToNexusSmartAccountParameters}
 * @returns Nexus Smart Account. {@link NexusAccount}
 *
 * @example
 * import { toNexusAccount } from '@biconomy/abstractjs'
 * import { createWalletClient, http } from 'viem'
 * import { mainnet } from 'viem/chains'
 *
 * const account = await toNexusAccount({
 *   signer: '0x...',
 *   chainConfiguration: {
 *     chain: mainnet,
 *     transport: http(),
 *     version: getMEEVersion(DEFAULT_MEE_VERSION),
 *   }
 * })
 */
export const toNexusAccount = async (
  parameters: ToNexusSmartAccountParameters
): Promise<NexusAccount> => {
  const {
    signer: _signer,
    chainConfiguration: {
      chain,
      version: meeConfig,
      transport: transportConfig,
      versionCheck = true,
      accountAddress: accountAddress_
    },
    index = 0n,
    validators: customValidators,
    executors: customExecutors,
    hook: customHook,
    fallbacks: customFallbacks,
    prevalidationHooks: customPrevalidationHooks,
    initData: customInitData
  } = parameters

  // if the MEE version is not older than 2.0.0 ? SDK checks for cancun support and throw error if not
  if (!isVersionOlder(meeConfig.version, MEEVersion.V2_0_0)) {
    // check if the chain supports > 1.2.0
    const hasCancun = await supportsCancun({
      chain,
      transport: transportConfig
    })

    if (!hasCancun) {
      throw new Error(
        `MEE version (${meeConfig.version}) is not supported for the ${chain.name} chain. Please use a version earlier than 2.0.0 or a chain that supports Cancun.`
      )
    }
  }

  const publicClient = createPublicClient({ chain, transport: transportConfig })

  if (versionCheck) {
    // All these version specific contract addresses were checked whether it was deployed or not.
    const addressesToDeploymentSet = new Set([
      meeConfig.bootStrapAddress,
      meeConfig.defaultValidatorAddress,
      meeConfig.validatorAddress,
      meeConfig.factoryAddress,
      meeConfig.implementationAddress
    ])

    if (meeConfig.moduleRegistry) {
      addressesToDeploymentSet.add(meeConfig.moduleRegistry.registryAddress)
    }

    if (meeConfig.composableModuleAddress) {
      addressesToDeploymentSet.add(meeConfig.composableModuleAddress)
    }

    // Filtering zero address because sometimes the default validator is zeroAddress which needs to be excluded
    const addressesToDeploymentCheck = [...addressesToDeploymentSet].filter(
      (address) => address !== zeroAddress
    )

    await Promise.all(
      addressesToDeploymentCheck.map(async (address) => {
        // Checks if the MEE contracts are deployed or not
        // This ensures the MEE version suite is supported or not for the chain
        const bytecode = await publicClient.getCode({
          address
        })

        if (!bytecode || bytecode === "0x") {
          console.error(
            `MEE version (${meeConfig.version}) is not supported for the ${chain.name} chain. Contract address (${address}) is not deployed`
          )

          throw new Error(
            `MEE version (${meeConfig.version}) is not supported for the ${chain.name} chain.`
          )
        }
      })
    )
  }

  const signer = await toSigner({ signer: _signer })

  const walletClient = toWalletClient({
    unresolvedSigner: _signer,
    resolvedSigner: signer,
    chain,
    transport: transportConfig
  })

  // Prepare validator modules
  const validators: Validator[] = await prepareValidators(
    walletClient,
    meeConfig,
    customValidators
  )

  const defaultValidator = toDefaultModule({ walletClient })

  // For 1.2.x accounts, no explicit validators will be added. So default validator will be used
  let module = validators[0] || defaultValidator

  // Prepare executor modules
  const executors = prepareExecutors(meeConfig, customExecutors)

  // Prepare hook module
  const hook = customHook || toEmptyHook()

  // Prepare fallback modules
  const fallbacks = prepareFallbacks(meeConfig, customFallbacks)

  // Generate the initialization data for the account using the initNexus function
  const prevalidationHooks = customPrevalidationHooks || []

  // prepare factory data
  const { initData, factoryData } = prepareFactoryData(meeConfig, {
    accountIndex: index,
    defaultValidator: toInitData(defaultValidator),
    prevalidationHooks,
    validators: validators.map(toInitData),
    executors: executors.map(toInitData),
    hook: toInitData(hook),
    fallbacks: fallbacks.map(toInitData),
    customInitData
  })

  /**
   * @description Gets the init code for the account
   * @returns The init code as a hexadecimal string
   */
  const getInitCode = () => concatHex([meeConfig.factoryAddress, factoryData])

  let _accountAddress: Address | undefined = accountAddress_
  let _eip712Domain: GetEip712DomainReturnType

  const accountId: NexusAccountId = (await publicClient.readContract({
    address: meeConfig.implementationAddress,
    abi: parseAbi(["function accountId() public view returns (string)"]),
    functionName: "accountId",
    args: []
  })) as NexusAccountId

  /**
   * @description Gets the counterfactual address of the account
   * @returns The counterfactual address
   * @throws {Error} If unable to get the counterfactual address
   */
  const getAddress = async (): Promise<Address> => {
    if (!isNullOrUndefined(_accountAddress)) return _accountAddress

    const addressFromFactory = await getNexusAddress({
      factoryAddress: meeConfig.factoryAddress,
      index,
      initData,
      publicClient
    })

    if (!addressEquals(addressFromFactory, zeroAddress)) {
      _accountAddress = addressFromFactory
      return addressFromFactory
    }

    throw new Error("Failed to get account address")
  }

  /**
   * Use viem helper to obtain and cache the eip712 domain for the account
   */
  const getEip712Domain = async (): Promise<GetEip712DomainReturnType> => {
    if (!isNullOrUndefined(_eip712Domain)) return _eip712Domain
    const eip712Domain = await getEip712DomainViemAction(publicClient, {
      address: await getAddress(),
      factory: meeConfig.factoryAddress,
      factoryData
    })
    _eip712Domain = eip712Domain
    return eip712Domain
  }

  /**
   * @description Calculates the hash of a user operation
   * @param userOp - The user operation
   * @returns The hash of the user operation
   */
  const getUserOpHash = (userOp: UserOperation): Hex =>
    getUserOperationHash({
      chainId: chain.id,
      entryPointAddress: entryPoint07Address,
      entryPointVersion: "0.7",
      userOperation: userOp
    })

  /**
   * @description Encodes a batch of calls for execution
   * @param calls - An array of calls to encode
   * @param mode - The execution mode
   * @returns The encoded calls
   */
  const encodeExecuteBatch = async (
    calls: readonly Call[],
    mode = EXECUTE_BATCH
  ): Promise<Hex> => {
    const executionAbiParams: AbiParameter = {
      type: "tuple[]",
      components: [
        { name: "target", type: "address" },
        { name: "value", type: "uint256" },
        { name: "callData", type: "bytes" }
      ]
    }
    const executions = calls.map((tx) => ({
      target: tx.to,
      callData: tx.data ?? "0x",
      value: BigInt(tx.value ?? 0n)
    }))

    const executionCalldataPrep = encodeAbiParameters(
      [executionAbiParams],
      [executions]
    )
    return encodeFunctionData({
      abi: parseAbi([
        "function execute(bytes32 mode, bytes calldata executionCalldata) external"
      ]),
      functionName: "execute",
      args: [mode, executionCalldataPrep]
    })
  }

  /**
   * @description Encodes a single call for execution
   * @param call - The call to encode
   * @param mode - The execution mode
   * @returns The encoded call
   */
  const encodeExecute = async (
    call: Call,
    mode = EXECUTE_SINGLE
  ): Promise<Hex> => {
    const executionCalldata = encodePacked(
      ["address", "uint256", "bytes"],
      [call.to as Hex, BigInt(call.value ?? 0n), (call.data ?? "0x") as Hex]
    )

    return encodeFunctionData({
      abi: parseAbi([
        "function execute(bytes32 mode, bytes calldata executionCalldata) external"
      ]),
      functionName: "execute",
      args: [mode, executionCalldata]
    })
  }

  /**
   * @description Encodes a composable calls for execution
   * @param call - The calls to encode
   * @returns The encoded composable compatible call
   */
  const encodeExecuteComposable = async (
    calls: ComposableCall[]
  ): Promise<Hex> => {
    // as of now, we just need to decide b/w 1.0.0 and 1.1.0
    // and we can decide this based on the `to` field:
    // it must be present for 1.0.0 and must not be present for 1.1.0+
    // instead, an input param with type TARGET should be present for 1.1.0+
    // In future, when more version are introduced, this logic will have to be updated
    // One approach for more version will be to just add a `composabilityVersion` field
    // `ComposableCall` type during the ComposableCall creation, since at the point where
    // we create the ComposableCall, we will know the composabilityVersion for sure

    // since this is the method on the toNexusAccount which is single chain,
    // all the composable calls should be of the same version
    const isComposability_v1_0_0 =
      calls.every((call) => !!call.to) &&
      !calls.every((call) =>
        call.inputParams.some(
          (param) => param.paramType === InputParamType.TARGET
        )
      )

    const composableCallsFormattedByVersion = calls.map((call) => {
      return isComposability_v1_0_0
        ? {
            to: call.to,
            value: call.value ?? 0n,
            functionSig: call.functionSig,
            inputParams: call.inputParams,
            outputParams: call.outputParams
          }
        : {
            functionSig: call.functionSig,
            inputParams: call.inputParams,
            outputParams: call.outputParams
          }
    })

    return encodeFunctionData({
      abi: isComposability_v1_0_0
        ? COMPOSABILITY_MODULE_ABI_V1_0_0
        : COMPOSABILITY_MODULE_ABI_V1_1_0,
      functionName: "executeComposable", // Function selector in Composability feature which executes the composable calls.
      args: [composableCallsFormattedByVersion] // Multiple composable calls can be batched here.
    })
  }

  /**
   * @description Gets the factory arguments for the account
   * @returns The factory arguments
   */
  const getFactoryArgs = async (): Promise<{
    factory: Address
    factoryData: Hex
  }> => {
    return {
      factory: meeConfig.factoryAddress,
      factoryData
    }
  }

  /**
   * @description Gets the nonce for the account along with modified key
   * @param parameters - Optional parameters for getting the nonce
   * @returns The nonce and the key
   */
  const getNonceWithKey = async (
    accountAddress: Address,
    parameters?: {
      key?: bigint
      validationMode?: "0x00" | "0x01" | "0x02"
      moduleAddress?: Address
    }
  ): Promise<NonceInfo> => {
    const defaultNonceKey = await getDefaultNonceKey(accountAddress, chain.id)

    const {
      key = defaultNonceKey,
      validationMode = "0x00",
      moduleAddress = module.module
    } = parameters ?? {}

    return getNonceWithKeyUtil(publicClient, accountAddress, {
      key,
      validationMode,
      moduleAddress
    })
  }

  /**
   * @description Gets the nonce for the account
   * @param parameters - Optional parameters for getting the nonce
   * @returns The nonce
   */
  const getNonce = async (parameters?: {
    key?: bigint
    validationMode?: "0x00" | "0x01" | "0x02"
    moduleAddress?: Address
  }): Promise<bigint> => {
    const accountAddress = await getAddress()

    const { nonce } = await getNonceWithKey(accountAddress, parameters)
    return nonce
  }

  /**
   * @description Signs typed data. Uses ERC-7739 TypedDataSign flow for modules that support it.
   * @param parameters - The typed data parameters
   * @returns The signature with module address prepended (Nexus-specific format)
   */
  async function signTypedData<
    const typedData extends TypedData | Record<string, unknown>,
    primaryType extends keyof typedData | "EIP712Domain" = keyof typedData
  >(parameters: TypedDataDefinition<typedData, primaryType>): Promise<Hex> {
    // Cast to base TypedDataDefinition for module interface compatibility
    const typedDataParams = parameters as TypedDataDefinition

    // Use ERC-7739 signing if supported, otherwise fall back to standard signing
    const signature =
      (await module.erc7739VersionSupported()) === 0
        ? await module.signTypedData(typedDataParams)
        : await module.signTypedDataErc7739(
            typedDataParams,
            (await getEip712Domain()).domain
          )

    // Prepend module address to signature (Nexus-specific wrapper)
    return encodePacked(["address", "bytes"], [module.module, signature])
  }

  /**
   * @description Signs a message. Uses ERC-7739 PersonalSign flow for modules that support it.
   * @param params - The parameters for signing
   * @param params.message - The message to sign
   * @returns The signature with module address prepended (Nexus-specific format)
   */
  const signMessage = async (parameters: {
    message: SignableMessage
  }): Promise<Hex> => {
    const { message } = parameters

    // Use ERC-7739 signing if supported, otherwise fall back to standard signing
    const signature =
      (await module.erc7739VersionSupported()) === 0
        ? await module.signMessage(message)
        : await module.signMessageErc7739(
            message,
            (await getEip712Domain()).domain
          )

    // Prepend module address to signature (Nexus-specific wrapper)
    return encodePacked(["address", "bytes"], [module.module, signature])
  }

  /**
   * @description Changes the active module for the account
   * @param module - The new module to set as active
   * @returns void
   */
  const setModule = (validationModule: Validator) => {
    module = validationModule
  }

  /**
   * @description Get authorization data for the EOA to Nexus Account
   * @param forMee - Whether to return the authorization data formatted for MEE. Defaults to false.
   * @param delegatedContract - The contract address to delegate the authorization to. Defaults to the implementation address.
   *
   * @example
   * const eip7702Auth = await nexusAccount.toDelegation() // Returns MeeAuthorization
   */
  async function toDelegation(
    params?: DelegationParams
  ): Promise<MeeAuthorization> {
    const {
      authorization: authorization_,
      multiChain,
      delegatedContract,
      chainId
    } = params || {}

    const contractAddress = delegatedContract || meeConfig.implementationAddress

    const authorization: SignAuthorizationReturnType =
      authorization_ ||
      (await walletClient.signAuthorization({
        contractAddress,
        chainId: multiChain ? 0 : chainId
      }))

    const eip7702Auth: MeeAuthorization = {
      chainId: `0x${(authorization.chainId).toString(16)}` as Hex,
      address: authorization.address as Hex,
      nonce: `0x${authorization.nonce.toString(16)}` as Hex,
      r: authorization.r as Hex,
      s: authorization.s as Hex,
      yParity: `0x${authorization.yParity!.toString(16)}` as Hex
    }

    return eip7702Auth
  }

  async function isDelegated(): Promise<boolean> {
    const code = await publicClient.getCode({ address: signer.address })
    return (
      !!code &&
      code
        ?.toLowerCase()
        .includes(meeConfig.implementationAddress.substring(2).toLowerCase())
    )
  }

  /**
   * @description Get authorization data to unauthorize the account
   * @returns Hex of the transaction hash
   *
   * @example
   * const eip7702Auth = await nexusAccount.unDelegate()
   */
  async function unDelegate(params?: UnDelegationParams): Promise<Hex> {
    const { authorization } = params || {}

    const deAuthorization: SignAuthorizationReturnType =
      authorization ||
      (await walletClient.signAuthorization({
        address: zeroAddress,
        executor: "self"
      }))

    return await walletClient.sendTransaction({
      to: signer.address,
      data: "0xdeadbeef",
      type: "eip7702",
      authorizationList: [deAuthorization]
    })
  }

  // ================================================
  //        Return the Nexus Account
  // ================================================
  return toSmartAccount({
    client: publicClient,
    entryPoint: {
      abi: EntrypointAbi,
      address: ENTRY_POINT_ADDRESS,
      version: "0.7"
    },
    getAddress,
    encodeCalls: (calls: readonly Call[]): Promise<Hex> => {
      return calls.length === 1
        ? encodeExecute(calls[0])
        : encodeExecuteBatch(calls)
    },
    getFactoryArgs,
    getStubSignature: async (): Promise<Hex> => module.getStubSignature(),
    signMessage,
    signTypedData,
    signUserOperation: async (
      parameters: UnionPartialBy<UserOperation, "sender"> & {
        chainId?: number | undefined
      }
    ): Promise<Hex> => {
      const { chainId = publicClient.chain.id, ...userOpWithoutSender } =
        parameters
      const address = await getAddress()

      const userOperation = {
        ...userOpWithoutSender,
        sender: address
      }

      const hash = getUserOperationHash({
        chainId,
        entryPointAddress: entryPoint07Address,
        entryPointVersion: "0.7",
        userOperation
      })
      return await module.signMessage({ raw: hash })
    },
    getNonce,

    extend: {
      isDelegated,
      toDelegation,
      unDelegate,
      entryPointAddress: entryPoint07Address,
      getAddress,
      accountId,
      getEip712Domain,
      getInitCode,
      getNonceWithKey,
      encodeExecute,
      encodeExecuteBatch,
      encodeExecuteComposable,
      getUserOpHash,
      factoryData,
      factoryAddress: meeConfig.factoryAddress,
      registryAddress: meeConfig.moduleRegistry?.registryAddress || zeroAddress,
      signer,
      walletClient,
      publicClient,
      chain,
      setModule,
      getModule: () => module,
      version: meeConfig
    }
  })
}
