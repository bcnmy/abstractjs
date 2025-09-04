import {
  type AbiParameter,
  type Account,
  type Address,
  type Chain,
  type ClientConfig,
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
  domainSeparator,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  keccak256,
  parseAbi,
  parseAbiParameters,
  toBytes,
  toHex,
  validateTypedData,
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
import type { MeeAuthorization } from "../clients/decorators/mee/getQuote"
import { ENTRY_POINT_ADDRESS, MEEVersion } from "../constants"
// Constants
import { COMPOSABILITY_MODULE_ABI, EntrypointAbi } from "../constants/abi"
import { toComposableExecutor, toComposableFallback } from "../modules"
import { toEmptyHook } from "../modules/toEmptyHook"
import type {
  BaseComposableCall,
  ComposableCall
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
import {
  EXECUTE_BATCH,
  EXECUTE_SINGLE,
  PARENT_TYPEHASH
} from "./utils/Constants"
// Utils
import type { Call } from "./utils/Types"
import {
  type EthersWallet,
  type TypedDataWith712,
  addressEquals,
  eip712WrapHash,
  getAccountDomainStructFields,
  getTypesForEIP712Domain,
  isNullOrUndefined,
  supportsCancun,
  typeToString
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
  /** Optional account address override */
  accountAddress?: Address
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
  }
>

const prepareValidators = async (
  signer: Signer,
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
        signer: await toSigner({ signer }),
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
      versionCheck = true
    },
    index = 0n,
    validators: customValidators,
    executors: customExecutors,
    hook: customHook,
    fallbacks: customFallbacks,
    prevalidationHooks: customPrevalidationHooks,
    accountAddress: accountAddress_,
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
          console.debug(
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
    signer,
    meeConfig,
    customValidators
  )

  const defaultValidator = toDefaultModule({ signer })

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
    const composableCalls: BaseComposableCall[] = calls.map((call) => {
      return {
        to: call.to,
        value: call.value ?? 0n,
        functionSig: call.functionSig,
        inputParams: call.inputParams,
        outputParams: call.outputParams
      }
    })

    return encodeFunctionData({
      abi: COMPOSABILITY_MODULE_ABI,
      functionName: "executeComposable", // Function selector in Composability feature which executes the composable calls.
      args: [composableCalls] // Multiple composable calls can be batched here.
    })
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
   * @description Signs typed data
   * @param parameters - The typed data parameters
   * @returns The signature
   */
  async function signTypedData<
    const typedData extends TypedData | Record<string, unknown>,
    primaryType extends keyof typedData | "EIP712Domain" = keyof typedData
  >(parameters: TypedDataDefinition<typedData, primaryType>): Promise<Hex> {
    const { message, primaryType, types: _types, domain } = parameters

    if (!domain) throw new Error("Missing domain")
    if (!message) throw new Error("Missing message")

    const types = {
      EIP712Domain: getTypesForEIP712Domain({ domain }),
      ..._types
    }

    // @ts-ignore: Comes from nexus parent typehash
    const messageStuff: Hex = message.stuff

    // @ts-ignore
    validateTypedData({
      domain,
      message,
      primaryType,
      types
    })

    const appDomainSeparator = domainSeparator({ domain })
    const accountDomainStructFields = await getAccountDomainStructFields(
      publicClient,
      await getAddress()
    )

    const parentStructHash = keccak256(
      encodePacked(
        ["bytes", "bytes"],
        [
          encodeAbiParameters(parseAbiParameters(["bytes32, bytes32"]), [
            keccak256(toBytes(PARENT_TYPEHASH)),
            messageStuff
          ]),
          accountDomainStructFields
        ]
      )
    )

    const wrappedTypedHash = eip712WrapHash(
      parentStructHash,
      appDomainSeparator
    )

    let signature = await module.signMessage({ raw: toBytes(wrappedTypedHash) })
    const contentsType = toBytes(typeToString(types as TypedDataWith712)[1])

    const signatureData = concatHex([
      signature,
      appDomainSeparator,
      messageStuff,
      toHex(contentsType),
      toHex(contentsType.length, { size: 2 })
    ])

    signature = encodePacked(
      ["address", "bytes"],
      [module.module, signatureData]
    )

    return signature
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
      v: `0x${authorization.v!.toString(16)}` as Hex,
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
    getFactoryArgs: async () => ({
      factory: meeConfig.factoryAddress,
      factoryData
    }),
    getStubSignature: async (): Promise<Hex> => module.getStubSignature(),
    /**
     * @description Signs a message
     * @param params - The parameters for signing
     * @param params.message - The message to sign
     * @returns The signature
     */
    async signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
      const tempSignature = await module.signMessage(message)
      return encodePacked(["address", "bytes"], [module.module, tempSignature])
    },
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
      return await module.signUserOpHash(hash)
    },
    getNonce,

    extend: {
      isDelegated,
      toDelegation,
      unDelegate,
      entryPointAddress: entryPoint07Address,
      getAddress,
      accountId,
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
