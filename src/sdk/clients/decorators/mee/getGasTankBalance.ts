import type { Address, Hex } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"

/**
 * Parameters for retrieving gas tank balance
 */
export type GetGasTankBalanceParams = {
  /**
   * The chainId of the gas tank
   * @example 1 // ETH
   */
  chainId: number
  /**
   * The token address of asset supported in the gas tank
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  tokenAddress: Address
  /**
   * The private key of the gas tank
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  privateKey: Hex
}

/**
 * Response payload containing gas tank balance
 */
export type GetGasTankBalancePayload = {
  balance: bigint
  decimals: number
}

export const getGasTankBalance = async (
  _client: BaseMeeClient,
  _parameters: GetGasTankBalanceParams
): Promise<GetGasTankBalancePayload> => {
  return {
    balance: 1n,
    decimals: 6
  }
}

export default getGasTankBalance
