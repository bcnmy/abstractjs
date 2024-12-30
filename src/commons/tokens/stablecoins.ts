import { erc20Abi } from "viem";
import {
  getMultichainContract,
  MultichainContract,
} from "../../utils/contract/getMultichainContract";
import { address } from "../../primitives";
import { arbitrum, avalanche, base, optimism, polygon } from "viem/chains";

export const mcUSDC = 
  getMultichainContract<typeof erc20Abi>({
    abi: erc20Abi,
    deployments: [
      ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", arbitrum.id],
      ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", base.id],
      ["0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", avalanche.id],
      ["0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", polygon.id],
    ],
  });
