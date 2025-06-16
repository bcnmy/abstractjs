import type { Address } from "viem"
import type { MultichainSmartAccount } from ".."

/**
 * Parameters for retrieving gas tank address
 */
export type GetGasTankAddressParams = {
  /**
   * The chainId of the gas tank
   * @example 1 // ETH
   */
  chainId: number
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
  mcNexus: MultichainSmartAccount,
  parameters: GetGasTankAddressParams
): Promise<GetGasTankAddressPayload> => {
  const { chainId } = parameters

  return { address: mcNexus.addressOn(chainId, true) }
}

export default getGasTankAddress
