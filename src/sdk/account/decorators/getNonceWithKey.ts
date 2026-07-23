import {
  type Address,
  type PublicClient,
  concat,
  getContract,
  toHex
} from "viem"
import { ENTRY_POINT_ADDRESS } from "../../constants"
import { EntrypointAbi } from "../../constants/abi"
import type { NonceInfo } from "../toNexusAccount"
import { sanitizeUrl } from "../utils"

export type GetNonceWithKeyParams = {
  key: bigint
  validationMode: "0x00" | "0x01" | "0x02"
  moduleAddress: Address
}

class NonceManager {
  private static instance: NonceManager
  private isNonceKeyBeingCalculated = new Map<string, boolean>()
  private lastIssuedKey = new Map<string, bigint>()

  private constructor() {}

  public static getInstance(): NonceManager {
    if (!NonceManager.instance) {
      NonceManager.instance = new NonceManager()
    }
    return NonceManager.instance
  }

  private buildNonceStoreKey(accountAddress: Address, chainId: number) {
    return `${accountAddress.toLowerCase()}::${chainId}`
  }

  // Provides a unique, strictly-increasing nonce key per (account, chainId).
  // Uniqueness must not depend on the wall clock advancing between calls: the
  // previous implementation read Date.now() with a setTimeout(1) spacer, but
  // setTimeout(1) does not guarantee Date.now() advances, so two same-chain
  // userOps built concurrently could receive the same key and therefore the
  // same nonce (nonce collision at quote construction).
  public async getDefaultNonceKey(
    accountAddress: Address,
    chainId: number
  ): Promise<bigint> {
    const storeKey = this.buildNonceStoreKey(accountAddress, chainId)

    while (this.isNonceKeyBeingCalculated.get(storeKey)) {
      await new Promise((resolve) => setTimeout(resolve, 1)) // wait for 1 ms if another key is being calculated
    }

    this.isNonceKeyBeingCalculated.set(storeKey, true)
    try {
      // Base the key on the clock but force it strictly greater than the last key
      // issued for this (account, chainId), so concurrently-built userOps always
      // get distinct keys regardless of timer resolution.
      const now = BigInt(Date.now())
      const prev = this.lastIssuedKey.get(storeKey) ?? 0n
      const key = now > prev ? now : prev + 1n
      this.lastIssuedKey.set(storeKey, key)
      return key
    } finally {
      this.isNonceKeyBeingCalculated.set(storeKey, false)
    }
  }

  public async getNonceWithKey(
    client: PublicClient,
    accountAddress: Address,
    parameters: GetNonceWithKeyParams
  ): Promise<NonceInfo> {
    const TIMESTAMP_ADJUSTMENT = 16777215n

    const { key: key_, validationMode, moduleAddress } = parameters

    try {
      const adjustedKey = BigInt(key_) % TIMESTAMP_ADJUSTMENT
      const key: string = concat([
        toHex(adjustedKey, { size: 3 }),
        validationMode,
        moduleAddress
      ])

      const entryPointContract = getContract({
        address: ENTRY_POINT_ADDRESS,
        abi: EntrypointAbi,
        client
      })

      const nonce = await entryPointContract.read.getNonce([
        accountAddress,
        BigInt(key)
      ])

      return { nonceKey: BigInt(key), nonce }
    } catch (error) {
      const errorMessage = (error as Error).message ?? "RPC issue"
      throw new Error(
        `Failed to fetch nonce due to the error: ${sanitizeUrl(errorMessage)}`
      )
    }
  }
}

export const getDefaultNonceKey = async (
  accountAddress: Address,
  chainId: number
): Promise<bigint> => {
  const manager = NonceManager.getInstance()
  return manager.getDefaultNonceKey(accountAddress, chainId)
}

/**
 * @description Gets the nonce for the account along with modified key
 * @param client Viem public client
 * @param accountAddress EVM wallet account address
 * @param chainId evm chainId
 * @param parameters Optional parameters for getting the nonce
 * @returns The nonce and the key
 */
export const getNonceWithKeyUtil = async (
  client: PublicClient,
  accountAddress: Address,
  parameters: GetNonceWithKeyParams
): Promise<NonceInfo> => {
  const manager = NonceManager.getInstance()
  return manager.getNonceWithKey(client, accountAddress, parameters)
}
