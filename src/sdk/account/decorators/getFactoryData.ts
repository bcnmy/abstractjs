import {
  type Address,
  type Hex,
  encodeFunctionData,
  pad,
  parseAbi,
  toHex,
  zeroAddress,
  zeroHash
} from "viem"
import { NexusBootstrapAbi } from "../../constants/abi/NexusBootstrapAbi"
import { getVersion, isVersionOlder } from "../utils/getVersion"

/**
 * Parameters for generating K1 factory initialization data
 * @property signerAddress - {@link Address} The address of the EOA signer
 * @property index - Account index as BigInt for deterministic deployment
 * @property attesters - Array of {@link Address} attester addresses for account verification
 * @property attesterThreshold - Minimum number of attesters required for validation
 */
export type GetK1FactoryDataParams = {
  signerAddress: Address
  index: bigint
  attesters: Address[]
  attesterThreshold: number
}

/**
 * Generates encoded factory data for K1 account creation
 *
 * @param params - {@link GetK1FactoryDataParams} Parameters for K1 account creation
 * @param params.signerAddress - The address of the EOA signer
 * @param params.index - Account index for deterministic deployment
 * @param params.attesters - Array of attester addresses
 * @param params.attesterThreshold - Minimum number of attesters required
 *
 * @returns Promise resolving to {@link Hex} encoded function data for account creation
 *
 * @example
 * const factoryData = await getK1FactoryData({
 *   signerAddress: "0x123...",
 *   index: BigInt(0),
 *   attesters: ["0xabc...", "0xdef..."],
 *   attesterThreshold: 2
 * });
 */
export const getK1FactoryData = ({
  signerAddress,
  index,
  attesters,
  attesterThreshold
}: GetK1FactoryDataParams): Hex =>
  encodeFunctionData({
    abi: parseAbi([
      "function createAccount(address eoaOwner, uint256 index, address[] attesters, uint8 threshold) external returns (address)"
    ]),
    functionName: "createAccount",
    args: [signerAddress, index, attesters, attesterThreshold]
  })

export type GetUniversalFactoryDataParams = {
  /** Hex string of the validator init data */
  initData: Hex
  /** Account index for deterministic deployment */
  index: bigint
}

export const getUniversalFactoryData = ({
  initData,
  index
}: GetUniversalFactoryDataParams): Hex => {
  const salt = pad(toHex(index), { size: 32 })

  return encodeFunctionData({
    abi: parseAbi([
      "function createAccount(bytes initData, bytes32 salt) external returns (address)"
    ]),
    functionName: "createAccount",
    args: [initData, salt]
  })
}

export type ModuleConfig = {
  module: Address
  data: Hex
}

export type GetFactoryInitDataParams = {
  /** Array of validator modules with their initialization data */
  validators: Array<ModuleConfig>
  /** Array of executor modules with their initialization data */
  executors: Array<ModuleConfig>
  /** Hook module with its initialization data */
  hook: ModuleConfig
  /** Array of fallback modules with their initialization data */
  fallbacks: Array<ModuleConfig>
  /** Array of attester addresses for account verification */
  attesters: Address[]
  /** Minimum number of attesters required for validation */
  attesterThreshold: number
  /** Optional registry contract address */
  registryAddress: Address
}

export const getFactoryInitData = ({
  validators,
  executors,
  hook,
  fallbacks,
  attesters,
  attesterThreshold,
  registryAddress
}: GetFactoryInitDataParams): Hex => {
  return encodeFunctionData({
    abi: NexusBootstrapAbi,
    functionName: "initNexus",
    args: [
      validators,
      executors,
      hook,
      fallbacks,
      registryAddress,
      attesters,
      attesterThreshold
    ]
  })
}

export type GetFactoryDataParams = {
  // Deprecated field for older versions of the SDK. Useful until version 0.2.2
  useK1Config: boolean
} & GetK1FactoryDataParams &
  GetUniversalFactoryDataParams

export const getFactoryData = (params: GetFactoryDataParams): Hex => {
  const {
    initData,
    index,
    attesters,
    attesterThreshold,
    useK1Config,
    signerAddress
  } = params

  if (isVersionOlder(getVersion(), "0.2.2") && useK1Config) {
    return getK1FactoryData({
      signerAddress,
      index,
      attesters,
      attesterThreshold
    })
  }

  return getUniversalFactoryData({
    index,
    initData
  })
}
