import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"
import type { NonceInfo } from "../toNexusAccount"

/**
 * Parameters for retrieving gas tank nonce
 */
export type GetGasTankNonceParams = {
  /**
   * The chainId of the gas tank
   * @example 1 // ETH
   */
  chainId: number
}

export const getGasTankNonce = async (
  mcNexus: MultichainSmartAccount,
  parameters: GetGasTankNonceParams
): Promise<NonceInfo> => {
  const { chainId } = parameters

  const { getNonceWithKey, address } = mcNexus.deploymentOn(chainId, true)

  return getNonceWithKey(address)
}

export default getGasTankNonce
