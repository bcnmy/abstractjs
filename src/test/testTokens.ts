import { erc20Abi } from "viem"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { getMultichainContract } from "../sdk/account/utils/getMultichainContract"

/**
 * Internal testnet USDC token.
 */
export const testnetMcTestUSDC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0xD0461f0516E2202c86145530494d36A0Ed431Ee7", baseSepolia.id],
    ["0x2eadb16b44743c3a670ce6fc4d4c0e9eb41ca5c7", optimismSepolia.id]
  ]
})

/**
 * Internal testnet USDC token, with Permit.
 */
export const testnetMcTestUSDCP = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x016b744B7E8d7EF72349a8e17178721Fd6126424", baseSepolia.id],
    ["0xcb90606250ff24cb6b1261117ba29823af768230", optimismSepolia.id]
  ]
})
