import { erc20Abi } from "viem"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { getMultichainContract } from "../sdk/account/utils/getMultichainContract"

/**
 * Internal testnet USDC token.
 */
export const testnetMcTestUSDC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xb394e82fd251de530c9d71cbee9527a4cf690e57", baseSepolia.id],
    ["0xbb4ba1a6875d76a6175239ef8644be85f671851c", optimismSepolia.id]
  ]
})

/**
 * Internal testnet USDC token, with Permit.
 */
export const testnetMcTestUSDCP = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x8976987ebee0806924ae17eed12229cf4789cb1f", baseSepolia.id],
    ["0x6db5b92627d073e602ef08ee1699de2e4b5e557d", optimismSepolia.id]
  ]
})
