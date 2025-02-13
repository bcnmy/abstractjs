import { erc20Abi } from "viem"
import { base, baseSepolia, mainnet, optimism } from "viem/chains"
import { getMultichainContract } from "../../account/utils/getMultichainContract"

export const mcAUSDC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c", mainnet.id],
    ["0x38d693cE1dF5AaDF7bC62595A37D667aD57922e5", optimism.id],
    ["0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB", base.id]
  ]
})

export const testnetMcUSDC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x036CbD53842c5426634e7929541eC2318f3dCF7e", baseSepolia.id],
    ["0x5fd84259d66Cd46123540766Be93DFE6D43130D7", optimism.id]
  ]
})
