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

import {
  ENTRY_POINT_ADDRESS,
  LATEST_DEFAULT_ADDRESSES,
  REGISTRY_ADDRESS
} from "../constants"
// Constants
import { EntrypointAbi } from "../constants/abi"
import {
  getDefaultNexusAddress,
  getK1NexusAddress
} from "./decorators/getNexusAddress"

// Modules
import { toK1Validator } from "../modules/k1Validator/toK1Validator"
import type { Module } from "../modules/utils/Types"

import {
  getDefaultFactoryData,
  getK1FactoryData
} from "./decorators/getFactoryData"
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
import { getConfigFromVersion } from "./utils/getVersion"
import { type EthereumProvider, type Signer, toSigner } from "./utils/toSigner"

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
  /** Optional active validation module */
  module?: Module
  /** Optional account address override */
  accountAddress?: Address
  /** Attester addresses to apply to the account */
  attesters?: Address[]
  /** Optional attestors threshold for the account */
  attesterThreshold?: number
  /** Optional boot strap address */
  bootStrapAddress?: Address
  /** Optional registry address */
  registryAddress?: Address
  /** Optional version of the SDK. Used only if old configurations are required for the purpose of upgrading or migrating accounts.
   * This is not required for normal account creation. It will override configurations for the attester and factory addresses.
   * It should be used only if the account is being migrated from an older version of the SDK. Do not use this for new accounts.
   */
  oldVersion?:
    | `${number}.${number}.${number}`
    | `${number}.${number}`
    | `${number}`
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
> &
  OneOf<
    CustomNexusConfigurationParameters | DefaultNexusConfigurationParameters
  >

type NexusConfigurationParameters = {
  /** Factory address */
  factoryAddress: Address
  /** Validator address */
  validatorAddress: Address
  /** Optional validator init data. Defaults to signer address */
  validatorInitData?: Hex
}

type DefaultNexusConfigurationParameters = {
  /** Use k1 config. Defaults to true. This is gas optimized and recommended for default usage */
  useK1Config?: true
} & UnionPartialBy<
  NexusConfigurationParameters,
  "factoryAddress" | "validatorAddress"
>

type CustomNexusConfigurationParameters = {
  /** For custom configurations, useK1Config must be false. factoryAddress and validatorAddress must be provided */
  useK1Config: false
} & NexusConfigurationParameters

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
    getCounterFactualAddress: () => Promise<Address>
    isDeployed: () => Promise<boolean>
    getInitCode: () => Hex
    encodeExecute: (call: Call) => Promise<Hex>
    encodeExecuteBatch: (calls: readonly Call[]) => Promise<Hex>
    getUserOpHash: (userOp: UserOperation) => Hex
    setModule: (validationModule: Module) => void
    getModule: () => Module
    factoryData: Hex
    factoryAddress: Address
    validatorAddress: Address
    bootStrapAddress: Address
    registryAddress: Address
    attesters: Address[]
    signer: Signer
    publicClient: PublicClient
    walletClient: WalletClient
    chain: Chain
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
    module: module_,
    key = "nexus account",
    name = "Nexus Account",
    attesterThreshold = 1,
    useK1Config = true,
    validatorInitData: validatorInitData_,
    oldVersion,
    registryAddress = REGISTRY_ADDRESS
  } = parameters

  let {
    attesters = LATEST_DEFAULT_ADDRESSES.attesters,
    factoryAddress = LATEST_DEFAULT_ADDRESSES.factoryAddress,
    validatorAddress = LATEST_DEFAULT_ADDRESSES.validatorAddress,
    bootStrapAddress = LATEST_DEFAULT_ADDRESSES.bootStrapAddress
  } = parameters

  if (oldVersion) {
    ;({ attesters, factoryAddress, validatorAddress, bootStrapAddress } =
      getConfigFromVersion(oldVersion))
  }

  // @ts-ignore
  const signer = await toSigner({ signer: _signer })
  const walletClient = createWalletClient({
    account: signer,
    chain,
    transport,
    key,
    name
  }).extend(publicActions)

  const signerAddress = walletClient.account.address
  const publicClient = createPublicClient({ chain, transport })

  const entryPointContract = getContract({
    address: ENTRY_POINT_ADDRESS,
    abi: EntrypointAbi,
    client: {
      public: publicClient,
      wallet: walletClient
    }
  })

  const validatorInitData = validatorInitData_ ?? signerAddress
  const factoryData = useK1Config
    ? await getK1FactoryData({
        signerAddress,
        index,
        attesters,
        attesterThreshold
      })
    : await getDefaultFactoryData({
        validatorInitData,
        index,
        publicClient,
        walletClient,
        bootStrapAddress,
        registryAddress,
        attesters,
        attesterThreshold,
        validatorAddress
      })

  /**
   * @description Gets the init code for the account
   * @returns The init code as a hexadecimal string
   */
  const getInitCode = () => concatHex([factoryAddress, factoryData])

  let _accountAddress: Address | undefined = parameters.accountAddress
  /**
   * @description Gets the counterfactual address of the account
   * @returns The counterfactual address
   * @throws {Error} If unable to get the counterfactual address
   */
  const getCounterFactualAddress = async (): Promise<Address> => {
    if (!isNullOrUndefined(_accountAddress)) return _accountAddress
    try {
      await entryPointContract.simulate.getSenderAddress([getInitCode()])
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    } catch (e: any) {
      if (e?.cause?.data?.errorName === "SenderAddressResult") {
        const accountAddressFromError = e?.cause.data.args[0] as Address
        if (!addressEquals(accountAddressFromError, zeroAddress)) {
          _accountAddress = accountAddressFromError
          return accountAddressFromError
        }
      }
    }

    const addressFromFactory = useK1Config
      ? await getK1NexusAddress({
          publicClient,
          signerAddress,
          index,
          attesters,
          threshold: attesterThreshold,
          factoryAddress
        })
      : await getDefaultNexusAddress({
          publicClient,
          signerAddress,
          index,
          factoryAddress
        })

    if (!addressEquals(addressFromFactory, zeroAddress)) {
      _accountAddress = addressFromFactory
      return addressFromFactory
    }

    throw new Error("Failed to get counterfactual account address")
  }

  let module =
    module_ ??
    toK1Validator({
      address: validatorAddress,
      accountAddress: await getCounterFactualAddress(),
      initData: signerAddress,
      deInitData: "0x",
      signer
    })

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
        parameters?.moduleAddress ?? (module.address as Hex)
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
   * @description Changes the active module for the account
   * @param module - The new module to set as active
   * @returns void
   */
  const setModule = (validationModule: Module): void => {
    module = validationModule
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
        [factoryAddress, factoryData, signature]
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
    getFactoryArgs: async () => ({ factory: factoryAddress, factoryData }),
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
      setModule,
      getModule: () => module,
      factoryData,
      factoryAddress,
      validatorAddress,
      bootStrapAddress,
      registryAddress,
      signer,
      walletClient,
      publicClient,
      attesters,
      chain
    }
  })
}
