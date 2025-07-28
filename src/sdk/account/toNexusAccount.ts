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
import { DEFAULT_NEXUS_VERSION, ENTRY_POINT_ADDRESS } from "../constants"
// Constants
import { COMPOSABILITY_MODULE_ABI, EntrypointAbi } from "../constants/abi"
import { toComposableExecutor, toComposableFallback } from "../modules"
import { toEmptyHook } from "../modules/toEmptyHook"
import { getNexus } from "../modules/utils/Helpers"
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
  type AddressConfig,
  type NexusAccountId,
  type NexusVersion,
  isVersionOlder
} from "./utils/getVersion"
import { type EthereumProvider, type Signer, toSigner } from "./utils/toSigner"
import { toWalletClient } from "./utils/toWalletClient"

export type GetInitDataParams = {
  accountIndex: bigint
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

export type NexusOptions = {
  /** Optional nexus config for the Nexus Smart Account. If undefined, the latest version will be used. */
  nexusConfig?: AddressConfig
}
/**
 * Parameters for creating a Nexus Smart Account
 */
export type ToNexusSmartAccountParameters = {
  /** The blockchain network */
  chain: Chain
  /** The transport configuration */
  transport: ClientConfig["transport"]
  /** The signer account or address */
  signer: OneOf<
    | EthereumProvider
    | WalletClient<Transport, Chain | undefined, Account>
    | LocalAccount
    | EthersWallet
  >
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
  /** Optional bootstrap address */
  bootStrapAddress?: Address
  /** Optional implementation address */
  implementationAddress?: Address
  /** Optional Nexus options */
  options?: NexusOptions
  /** Optional factory address */
  factoryAddress?: Address
  /** Optional init data */
  initData?: Hex
} & Prettify<
  Pick<
    ClientConfig<Transport, Chain, Account, RpcSchema>,
    | "account"
    | "cacheTime"
    | "chain"
    | "key"
    | "name"
    | "pollingInterval"
    | "rpcSchema"
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
  authorization?: SignAuthorizationReturnType
  multiChain?: boolean
  delegatedContract?: Address
}

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

    /** Nexus version */
    version: NexusVersion
  }
>

// Resolves the latest default nexus version or resolves the user defined version for nexus smart account
const resolveNexusConfig = async (
  hasCancun: boolean,
  customNexusConfig?: AddressConfig
): Promise<AddressConfig> => {
  let nexusConfig: AddressConfig

  if (customNexusConfig) {
    // If the old version + no cancun ? new nexus is not supported
    const unsupportedVersion =
      !isVersionOlder(customNexusConfig.version, "1.2.0") && !hasCancun

    if (unsupportedVersion) {
      throw new Error(
        "Nexus version is not supported for this chain. Please use a version earlier than 1.2.0 or a chain that supports Cancun."
      )
    }

    const defaultNexusConfig = getNexus(customNexusConfig.version)

    nexusConfig = {
      version: customNexusConfig.version || defaultNexusConfig.version,
      accountId: customNexusConfig.accountId || defaultNexusConfig.accountId,
      implementationAddress:
        customNexusConfig.implementationAddress ||
        defaultNexusConfig.implementationAddress,
      bootStrapAddress:
        customNexusConfig.bootStrapAddress ||
        defaultNexusConfig.bootStrapAddress,
      factoryAddress:
        customNexusConfig.factoryAddress || defaultNexusConfig.factoryAddress,
      validatorAddress:
        customNexusConfig.validatorAddress ||
        defaultNexusConfig.validatorAddress,
      defaultValidatorAddress:
        customNexusConfig.defaultValidatorAddress ||
        defaultNexusConfig.defaultValidatorAddress,
      moduleRegistry:
        customNexusConfig.moduleRegistry || defaultNexusConfig.moduleRegistry
    }
  } else {
    nexusConfig = hasCancun
      ? getNexus(DEFAULT_NEXUS_VERSION)
      : getNexus("1.0.2")
  }

  return nexusConfig
}

const prepareValidators = async (
  signer: Signer,
  nexusConfig: AddressConfig,
  customValidators?: Validator[]
): Promise<Validator[]> => {
  let validators: Validator[] = []

  if (customValidators && customValidators.length > 0) {
    return customValidators
  }

  if (nexusConfig.version === "1.0.2") {
    validators = [
      toMeeK1Module({
        signer: await toSigner({ signer }),
        module: nexusConfig.defaultValidatorAddress
      })
    ]
  } else {
    // Default validator address is zeroAddress
    // This default validator will be used for 1.2.X versions further
    validators = [toDefaultModule({ signer })]
  }

  return validators
}

const prepareExecutors = (
  nexusConfig: AddressConfig,
  customExecutors?: GenericModuleConfig[]
): GenericModuleConfig[] => {
  let executors: GenericModuleConfig[] = []

  if (isVersionOlder(nexusConfig.version, "1.2.0")) {
    // if using <=1.0.2, add the composable executor
    const composableExecutor = toComposableExecutor()
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
  nexusConfig: AddressConfig,
  customFallbacks?: GenericModuleConfig[]
): GenericModuleConfig[] => {
  let fallbacks: GenericModuleConfig[] = []

  if (isVersionOlder(nexusConfig.version, "1.2.0")) {
    // if nexus version <=1.0.2, add the composable fallback
    const composableFallback = toComposableFallback()
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
  signer: Signer,
  nexusConfig: AddressConfig,
  initDataParams: GetInitDataParams
): { initData: Hex; factoryData: Hex } => {
  let factoryData: Hex = "0x"
  let initData: Hex = "0x"

  switch (nexusConfig.version) {
    case "1.0.2": {
      if (!nexusConfig.moduleRegistry) {
        throw new Error("Module registry not found in nexus config")
      }

      initData =
        initDataParams.customInitData ||
        getInitDataWithRegistry({
          bootStrapAddress: nexusConfig.bootStrapAddress,
          validators: initDataParams.validators,
          registryAddress: nexusConfig.moduleRegistry.registryAddress,
          attesters: nexusConfig.moduleRegistry.attesters,
          attesterThreshold: nexusConfig.moduleRegistry.attesterThreshold,
          nexusVersion: nexusConfig.version
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
          defaultValidator: toInitData(toDefaultModule({ signer })),
          prevalidationHooks: initDataParams.prevalidationHooks,
          validators: initDataParams.validators,
          executors: initDataParams.executors,
          hook: initDataParams.hook,
          fallbacks: initDataParams.fallbacks,
          bootStrapAddress: nexusConfig.bootStrapAddress
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
 *   chain: mainnet,
 *   transport: http(),
 *   signer: '0x...',
 * })
 */
export const toNexusAccount = async (
  parameters: ToNexusSmartAccountParameters
): Promise<NexusAccount> => {
  const {
    chain,
    transport: transportConfig,
    signer: _signer,
    index = 0n,
    validators: customValidators,
    executors: customExecutors,
    hook: customHook,
    fallbacks: customFallbacks,
    prevalidationHooks: customPrevalidationHooks,
    accountAddress: accountAddress_,
    initData: customInitData,
    options = {}
  } = parameters

  // check if the chain supports > 1.2.0
  const hasCancun = await supportsCancun({
    chain,
    transport: transportConfig
  })

  const nexusConfig = await resolveNexusConfig(hasCancun, options.nexusConfig)

  const signer = await toSigner({ signer: _signer })

  const walletClient = toWalletClient({
    unresolvedSigner: _signer,
    resolvedSigner: signer,
    chain,
    transport: transportConfig
  })

  const publicClient = createPublicClient({ chain, transport: transportConfig })

  // Prepare validator modules
  const validators: Validator[] = await prepareValidators(
    signer,
    nexusConfig,
    customValidators
  )

  let module = validators[0]

  // Prepare executor modules
  const executors = prepareExecutors(nexusConfig, customExecutors)

  // Prepare hook module
  const hook = customHook || toEmptyHook()

  // Prepare fallback modules
  const fallbacks = prepareFallbacks(nexusConfig, customFallbacks)

  // Generate the initialization data for the account using the initNexus function
  const prevalidationHooks = customPrevalidationHooks || []

  // prepare factory data
  const { initData, factoryData } = prepareFactoryData(signer, nexusConfig, {
    accountIndex: index,
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
  const getInitCode = () => concatHex([nexusConfig.factoryAddress, factoryData])

  let _accountAddress: Address | undefined = accountAddress_
  const accountId: NexusAccountId = (await publicClient.readContract({
    address: nexusConfig.implementationAddress,
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
      factoryAddress: nexusConfig.factoryAddress,
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
      delegatedContract
    } = params || {}

    const contractAddress =
      delegatedContract || nexusConfig.implementationAddress

    const authorization: SignAuthorizationReturnType =
      authorization_ ||
      (await walletClient.signAuthorization({
        contractAddress
      }))

    const eip7702Auth: MeeAuthorization = {
      chainId: `0x${(multiChain ? 0 : chain.id).toString(16)}` as Hex,
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
        .includes(nexusConfig.implementationAddress.substring(2).toLowerCase())
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
      factory: nexusConfig.factoryAddress,
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
      factoryAddress: nexusConfig.factoryAddress,
      registryAddress:
        nexusConfig.moduleRegistry?.registryAddress || zeroAddress,
      signer,
      walletClient,
      publicClient,
      chain,
      setModule,
      getModule: () => module,
      version: nexusConfig.version
    }
  })
}
