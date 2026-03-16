import { Abi, encodePacked, Hex, keccak256, type Address } from "viem"

// Storage contract
export const NAMESPACE_STORAGE_CONTRACT_ADDRESS =
  "0x0000000671eb337E12fe5dB0e788F32e1D71B183" as Address
export const NAMESPACE_STORAGE_ABI: Abi = [
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "slot",
        type: "bytes32"
      },
      {
        internalType: "bytes32",
        name: "value",
        type: "bytes32"
      },
      {
        internalType: "address",
        name: "account",
        type: "address"
      }
    ],
    name: "writeStorage",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "namespace",
        type: "bytes32"
      },
      {
        internalType: "bytes32",
        name: "slot",
        type: "bytes32"
      }
    ],
    name: "readStorage",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
]

class NamespaceStorageManager {
  private static instance: NamespaceStorageManager
  private isNameSpaceStorageSlotKeyBeingCalculated = new Map<string, boolean>()

  private constructor() {}

  public static getInstance(): NamespaceStorageManager {
    if (!NamespaceStorageManager.instance) {
      NamespaceStorageManager.instance = new NamespaceStorageManager()
    }
    return NamespaceStorageManager.instance
  }

  private buildNameSpaceStorageKey(
    accountAddress: Address,
    callerAddress: Address,
    chainId: number
  ) {
    return `${accountAddress.toLowerCase()}::${callerAddress.toLowerCase()}::${chainId}`
  }

  // This function always make sure to provide a unique storage slot.
  // This is helpful to reduce storage slot collusion
  public async getDefaultStorageSlotKey(
    accountAddress: Address,
    callerAddress: Address,
    chainId: number
  ): Promise<bigint> {
    const storeKey = this.buildNameSpaceStorageKey(
      accountAddress,
      callerAddress,
      chainId
    )

    while (this.isNameSpaceStorageSlotKeyBeingCalculated.get(storeKey)) {
      await new Promise((resolve) => setTimeout(resolve, 1)) // wait for 1 ms if another key is being calculated
    }

    this.isNameSpaceStorageSlotKeyBeingCalculated.set(storeKey, true)
    const key = BigInt(Date.now())

    await new Promise((resolve) => setTimeout(resolve, 1)) // ensure next call is in the next millisecond
    this.isNameSpaceStorageSlotKeyBeingCalculated.set(storeKey, false)

    return key
  }

  public getStorageNameSpace(accountAddress: Address, callerAddress: Address) {
    return keccak256(
      encodePacked(["address", "address"], [accountAddress, callerAddress])
    )
  }

  public async getStorageNameSpaceSlot(
    accountAddress: Address,
    callerAddress: Address,
    chainId: number
  ) {
    const defaultKey = await this.getDefaultStorageSlotKey(
      accountAddress,
      callerAddress,
      chainId
    )

    return keccak256(
      encodePacked(
        ["address", "address", "uint256"],
        [
          accountAddress,
          accountAddress,
          // Unique timestamp for each slot so that slots are unique for every new request / flow
          defaultKey
        ]
      )
    )
  }
}

export const getStorageNameSpace = (
  accountAddress: Address,
  callerAddress: Address
): Hex => {
  const manager = NamespaceStorageManager.getInstance()
  return manager.getStorageNameSpace(accountAddress, callerAddress)
}

export const getStorageNameSpaceSlot = async (
  accountAddress: Address,
  callerAddress: Address,
  chainId: number
): Promise<Hex> => {
  const manager = NamespaceStorageManager.getInstance()
  return manager.getStorageNameSpaceSlot(accountAddress, callerAddress, chainId)
}
