import { type Address, erc20Abi } from "viem"
import type { MultichainSmartAccount } from ".."

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
}

/**
 * Response payload containing gas tank balance
 */
export type GetGasTankBalancePayload = {
  balance: bigint
  decimals: number
}

export const getGasTankBalance = async (
  mcNexus: MultichainSmartAccount,
  parameters: GetGasTankBalanceParams
): Promise<GetGasTankBalancePayload> => {
  const { chainId, tokenAddress } = parameters

  const { address, publicClient } = mcNexus.deploymentOn(chainId, true)

  const [balance, decimals] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address]
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
      args: []
    })
  ])

  return {
    balance,
    decimals
  }
}

export default getGasTankBalance
