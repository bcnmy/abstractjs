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

import { ENTRY_POINT_ADDRESS, LATEST_DEFAULT_ADDRESSES } from "../constants"
// Constants
import { EntrypointAbi } from "../constants/abi"
import { toComposableExecutor } from "../modules/toComposableExecutor"
import { toComposableFallback } from "../modules/toComposableFallback"
import { toEmptyHook } from "../modules/toEmptyHook"
import { toMeeModule } from "../modules/validators/mee/toMeeModule"
import type { Validator } from "../modules/validators/toValidator"
import { getFactoryData, getInitData } from "./decorators/getFactoryData"
import { getNexusAddress } from "./decorators/getNexusAddress"
import {
  EXECUTE_BATCH,
  EXECUTE_SINGLE,
  MAGIC_BYTES,
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
  /** Attester addresses to apply to the account */
  attesters?: Address[]
  /** Optional attestors threshold for the account */
  attesterThreshold?: number
  /** Optional validator modules configuration */
  validators?: Array<Validator>
  /** Optional executor modules configuration */
  executors?: Array<GenericModuleConfig>
  /** Optional hook module configuration */
  hook?: GenericModuleConfig
  /** Optional fallback modules configuration */
  fallbacks?: Array<GenericModuleConfig>
  /** Optional registry address */
  registryAddress?: Address
  /** Optional factory address */
  factoryAddress?: Address
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
    getCounterFactualAddress: () => Promise<Address>

    /** Checks if the account is deployed */
    isDeployed: () => Promise<boolean>

    /** Gets the init code for the account */
    getInitCode: () => Hex

    /** Encodes a single call for execution */
    encodeExecute: (call: Call) => Promise<Hex>

    /** Encodes a batch of calls for execution */
    encodeExecuteBatch: (calls: readonly Call[]) => Promise<Hex>

    /** Calculates the hash of a user operation */
    getUserOpHash: (userOp: UserOperation) => Hex

    /** Factory data used for account creation */
    factoryData: Hex

    /** Factory address used for account creation */
    factoryAddress: Address

    /** Attester addresses for account verification */
    attesters: Address[]

    /** The signer instance */
    signer: Signer

    /** The public client instance */
    publicClient: PublicClient

    /** The wallet client instance */
    walletClient: WalletClient

    /** The blockchain network */
    chain: Chain

    /** Get the active module */
    getModule: () => Validator

    /** Set the active module */
    setModule: (validationModule: Validator) => void
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
    attesterThreshold = 0,
    attesters = [],
    registryAddress = zeroAddress,
    validators: customValidators,
    executors: customExecutors,
    hook: customHook,
    fallbacks: customFallbacks,
    factoryAddress = LATEST_DEFAULT_ADDRESSES.factoryAddress,
    accountAddress: accountAddress_
  } = parameters

  // @ts-ignore
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

  // Prepare validator modules
  const validators = customValidators || [toMeeModule({ signer })]
  let [module] = validators

  // Prepare executor modules
  const executors = customExecutors || [toComposableExecutor()]

  // Prepare hook module
  const hook = customHook || toEmptyHook()

  // Prepare fallback modules
  const fallbacks = customFallbacks || [toComposableFallback()]

  // Generate the initialization data for the account using the initNexus function
  const bootStrapAddress = LATEST_DEFAULT_ADDRESSES.bootStrapAddress

  const initData = getInitData({
    validators: validators.map(toInitData),
    executors: executors.map(toInitData),
    hook: toInitData(hook),
    fallbacks: fallbacks.map(toInitData),
    registryAddress,
    attesters,
    attesterThreshold,
    bootStrapAddress
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
  const getCounterFactualAddress = async (): Promise<Address> => {
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

    throw new Error("Failed to get counterfactual account address")
  }

  /**
   * @description Checks if the account is deployed
   * @returns True if the account is deployed, false otherwise
   */
  const isDeployed = async (): Promise<boolean> => {
    const address = await getCounterFactualAddress()
    const contractCode = await publicClient.getCode({ address })
    return (contractCode?.length ?? 0) > 2
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
   * @description Gets the nonce for the account
   * @param parameters - Optional parameters for getting the nonce
   * @returns The nonce
   */
  const getNonce = async (parameters?: {
    key?: bigint
    validationMode?: "0x00" | "0x01"
    moduleAddress?: Address
  }): Promise<bigint> => {
    try {
      const TIMESTAMP_ADJUSTMENT = 16777215n
      const defaultedKey = BigInt(parameters?.key ?? 0n) % TIMESTAMP_ADJUSTMENT
      const defaultedValidationMode = parameters?.validationMode ?? "0x00"
      const key: string = concat([
        toHex(defaultedKey, { size: 3 }),
        defaultedValidationMode,
        parameters?.moduleAddress ?? (module.module as Hex)
      ])

      const accountAddress = await getCounterFactualAddress()
      return await entryPointContract.read.getNonce([
        accountAddress,
        BigInt(key)
      ])
    } catch (e) {
      return 0n
    }
  }

  /**
   * @description Signs a message
   * @param params - The parameters for signing
   * @param params.message - The message to sign
   * @returns The signature
   */
  const signMessage = async ({
    message
  }: { message: SignableMessage }): Promise<Hex> => {
    const tempSignature = await module.signMessage(message)

    const signature = encodePacked(
      ["address", "bytes"],
      [module.address as Hex, tempSignature]
    )

    const erc6492Signature = concat([
      encodeAbiParameters(
        [
          {
            type: "address",
            name: "create2Factory"
          },
          {
            type: "bytes",
            name: "factoryCalldata"
          },
          {
            type: "bytes",
            name: "originalERC1271Signature"
          }
        ],
        [factoryAddress, initData, signature]
      ),
      MAGIC_BYTES
    ])

    const accountIsDeployed = await isDeployed()
    return accountIsDeployed ? signature : erc6492Signature
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
      await getCounterFactualAddress()
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
      [module.address as Hex, signatureData]
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

  return toSmartAccount({
    client: walletClient,
    entryPoint: {
      abi: EntrypointAbi,
      address: ENTRY_POINT_ADDRESS,
      version: "0.7"
    },
    getAddress: getCounterFactualAddress,
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
    signMessage,
    signTypedData,
    signUserOperation: async (
      parameters: UnionPartialBy<UserOperation, "sender"> & {
        chainId?: number | undefined
      }
    ): Promise<Hex> => {
      const { chainId = publicClient.chain.id, ...userOpWithoutSender } =
        parameters
      const address = await getCounterFactualAddress()

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
      entryPointAddress: entryPoint07Address,
      getCounterFactualAddress,
      isDeployed,
      getInitCode,
      encodeExecute,
      encodeExecuteBatch,
      getUserOpHash,
      factoryData,
      factoryAddress,
      registryAddress,
      signer,
      walletClient,
      publicClient,
      attesters,
      chain,
      setModule,
      getModule: () => module
    }
  })
}
