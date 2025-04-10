import {
  type AbiParameter,
  type Account,
  type Address,
  type Authorization,
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
  concat,
  concatHex,
  createPublicClient,
  createWalletClient,
  domainSeparator,
  encodeAbiParameters,
  encodeFunctionData,
  encodePacked,
  getContract,
  keccak256,
  parseAbi,
  parseAbiParameters,
  publicActions,
  serializeSignature,
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
import {
  ENTRY_POINT_ADDRESS,
  NEXUS_ACCOUNT_FACTORY_ADDRESS,
  NEXUS_BOOTSTRAP_ADDRESS,
  NEXUS_IMPLEMENTATION_ADDRESS
} from "../constants"
// Constants
import { EntrypointAbi } from "../constants/abi"
import { COMPOSABILITY_MODULE_ABI } from "../constants/abi"
import { toEmptyHook } from "../modules/toEmptyHook"
import type {
  BaseComposableCall,
  ComposableCall
} from "../modules/utils/composabilityCalls"
import { toDefaultModule } from "../modules/validators/default/toDefaultModule"
import type { Validator } from "../modules/validators/toValidator"
import { getFactoryData, getInitData } from "./decorators/getFactoryData"
import { getNexusAddress } from "./decorators/getNexusAddress"
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
  typeToString
} from "./utils/Utils"
import { toInitData } from "./utils/toInitData"
import { type EthereumProvider, type Signer, toSigner } from "./utils/toSigner"

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
  /** Optional registry address */
  registryAddress?: Address
  /** Optional factory address */
  factoryAddress?: Address
  /** Optional bootstrap address */
  bootStrapAddress?: Address
  /** Optional implementation address */
  implementationAddress?: Address
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
     * forMee=true returns the formatted MeeAuthorization
     * forMee=false returns the raw SignAuthorizationReturnType
     */
    toAuthorization: {
      (forMee: true, delegatedContract?: Address): Promise<MeeAuthorization>
      (
        forMee: false,
        delegatedContract?: Address
      ): Promise<SignAuthorizationReturnType>
    }

    /** Execute the transaction to unauthorize the account */
    unDelegate: () => Promise<Hex>
  }
>

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
    transport,
    signer: _signer,
    index = 0n,
    key = "nexus account",
    name = "Nexus Account",
    registryAddress = zeroAddress,
    validators: customValidators,
    executors: customExecutors,
    hook: customHook,
    fallbacks: customFallbacks,
    prevalidationHooks: customPrevalidationHooks,
    accountAddress: accountAddress_,
    factoryAddress = NEXUS_ACCOUNT_FACTORY_ADDRESS,
    bootStrapAddress = NEXUS_BOOTSTRAP_ADDRESS,
    implementationAddress = NEXUS_IMPLEMENTATION_ADDRESS
  } = parameters

  const signer = await toSigner({ signer: _signer })
  const walletClient = createWalletClient({
    account: signer,
    chain,
    transport,
    key,
    name
  }).extend(publicActions)

  const publicClient = createPublicClient({ chain, transport })

  const entryPointContract = getContract({
    address: ENTRY_POINT_ADDRESS,
    abi: EntrypointAbi,
    client: {
      public: publicClient,
      wallet: walletClient
    }
  })

  // Prepare default validator module
  const defaultValidator = toDefaultModule({ signer })

  // Prepare validator modules
  const validators = customValidators || []

  // The default validator should be the defaultValidator unless custom validators have been set
  let module = customValidators?.[0] || defaultValidator

  // Prepare executor modules
  const executors = customExecutors || []

  // Prepare hook module
  const hook = customHook || toEmptyHook()

  // Prepare fallback modules
  const fallbacks = customFallbacks || []

  // Generate the initialization data for the account using the initNexus function
  const prevalidationHooks = customPrevalidationHooks || []

  const initData = getInitData({
    defaultValidator: toInitData(defaultValidator),
    validators: validators.map(toInitData),
    executors: executors.map(toInitData),
    hook: toInitData(hook),
    fallbacks: fallbacks.map(toInitData),
    registryAddress,
    bootStrapAddress,
    prevalidationHooks
  })

  // Generate the factory data with the bootstrap address and init data
  const factoryData = getFactoryData({ initData, index })

  /**
   * @description Gets the init code for the account
   * @returns The init code as a hexadecimal string
   */
  const getInitCode = () => concatHex([factoryAddress, factoryData])

  let _accountAddress: Address | undefined = accountAddress_
  /**
   * @description Gets the counterfactual address of the account
   * @returns The counterfactual address
   * @throws {Error} If unable to get the counterfactual address
   */
  const getAddress = async (): Promise<Address> => {
    if (!isNullOrUndefined(_accountAddress)) return _accountAddress

    const addressFromFactory = await getNexusAddress({
      factoryAddress,
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
        value: call.value,
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
   * @description Gets the nonce for the account
   * @param parameters - Optional parameters for getting the nonce
   * @returns The nonce
   */
  const getNonce = async (parameters?: {
    key?: bigint
    validationMode?: "0x00" | "0x01" | "0x02"
    moduleAddress?: Address
  }): Promise<bigint> => {
    const TIMESTAMP_ADJUSTMENT = 16777215n
    const {
      key: key_ = 0n,
      validationMode = "0x00",
      moduleAddress = module.module
    } = parameters ?? {}
    try {
      const adjustedKey = BigInt(key_) % TIMESTAMP_ADJUSTMENT
      const key: string = concat([
        toHex(adjustedKey, { size: 3 }),
        validationMode,
        moduleAddress
      ])
      const accountAddress = await getAddress()
      return await entryPointContract.read.getNonce([
        accountAddress,
        BigInt(key)
      ])
    } catch (e) {
      return 0n
    }
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
   * const eip7702Auth = await nexusAccount.toAuthorization(true) // Returns MeeAuthorization
   * const authorization = await nexusAccount.toAuthorization(false) // Returns SignAuthorizationReturnType
   */
  async function toAuthorization(
    forMee: true,
    delegatedContract?: Address
  ): Promise<MeeAuthorization>
  async function toAuthorization(
    forMee: false,
    delegatedContract?: Address
  ): Promise<SignAuthorizationReturnType>
  async function toAuthorization(
    forMee: boolean,
    delegatedContract?: Address
  ): Promise<SignAuthorizationReturnType | MeeAuthorization> {
    const contractAddress = delegatedContract ?? implementationAddress
    const authorization = await walletClient.signAuthorization({
      contractAddress,
      executor: "self",
      account: signer
    })

    if (forMee) {
      const eip7702Auth: MeeAuthorization = {
        address: contractAddress,
        nonce: `0x${authorization.nonce.toString(16)}`,
        r: authorization.r,
        s: authorization.s,
        v: `0x${authorization.v!.toString(16)}`,
        yParity: `0x${authorization.yParity!.toString(16)}`,
        signature: serializeSignature({
          r: authorization.r,
          s: authorization.s,
          v: authorization.v!,
          yParity: authorization.yParity
        })
      }
      return eip7702Auth
    }

    return authorization
  }

  /**
   * @description Get authorization data to unauthorize the account
   * @returns Hex of the transaction hash
   *
   * @example
   * const eip7702Auth = await nexusAccount.unDelegate()
   */
  async function unDelegate(): Promise<Hex> {
    const auth = await toAuthorization(false, zeroAddress)
    console.log({ auth })
    return await walletClient.sendTransaction({
      to: signer.address,
      value: BigInt(0),
      type: "eip7702",
      authorizationList: [auth]
    })
  }

  return toSmartAccount({
    client: walletClient,
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
      factory: factoryAddress,
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
      toAuthorization,
      unDelegate,
      entryPointAddress: entryPoint07Address,
      getAddress,
      getInitCode,
      encodeExecute,
      encodeExecuteBatch,
      encodeExecuteComposable,
      getUserOpHash,
      factoryData,
      factoryAddress,
      registryAddress,
      signer,
      walletClient,
      publicClient,
      chain,
      setModule,
      getModule: () => module
    }
  }) as unknown as NexusAccount
}
