import type { Address, Hex } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"

/**
 * Parameters for retrieving gas tank address
 */
export type GetGasTankAddressParams = {
  /**
   * The chainId of the gas tank
   * @example 1 // ETH
   */
  chainId: number
  /**
   * The private key of the gas tank
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  privateKey: Hex
}

/**
 * Response payload containing gas tank address
 */
export type GetGasTankAddressPayload = {
  /**
   * The address of the gas tank
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  address: Address
}

export const getGasTankAddress = async (
  _client: BaseMeeClient,
  _parameters: GetGasTankAddressParams
): Promise<GetGasTankAddressPayload> => {
  return {
    address: "" as Address
  }
}

export default getGasTankAddress
