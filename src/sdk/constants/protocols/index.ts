import type { Abi } from "viem"
import {
  arbitrumSepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia
} from "viem/chains"
import { polygon } from "viem/chains"
import { arbitrum } from "viem/chains"
import type { MultichainToken } from "../../account/utils/Types"
import {
  type MultichainContract,
  getMultichainContract
} from "../../account/utils/getMultichainContract"
import { AavePoolAbi, UniswapSwapRouterAbi } from "../abi"
import { mcAUSDC } from "../tokens"

export const mcAaveV3Pool = getMultichainContract<typeof AavePoolAbi>({
  abi: AavePoolAbi,
  deployments: [
    ["0x794a61358D6845594F94dc1DB02A252b5b4814aD", optimism.id],
    ["0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", base.id],
    ["0x794a61358D6845594F94dc1DB02A252b5b4814aD", polygon.id],
    ["0x794a61358D6845594F94dc1DB02A252b5b4814aD", arbitrum.id]
  ]
})

export const mcUniswapSwapRouter = getMultichainContract<
  typeof UniswapSwapRouterAbi
>({
  abi: UniswapSwapRouterAbi,
  deployments: [
    ["0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", arbitrum.id],
    ["0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", optimism.id],
    ["0x2626664c2603336E57B271c5C0b26F421741e481", base.id]
  ]
})

export const testnetMcUniswapSwapRouter = getMultichainContract<
  typeof UniswapSwapRouterAbi
>({
  abi: UniswapSwapRouterAbi,
  deployments: [
    ["0x101F443B4d1b059569D643917553c771E1b9663E", arbitrumSepolia.id],
    ["0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", optimismSepolia.id],
    ["0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", baseSepolia.id]
  ]
})

export type Protocol<TAbi extends Abi> = {
  name: string
  pool: MultichainContract<TAbi>
  lpToken: MultichainToken
}

export const aave: Protocol<typeof AavePoolAbi> = {
  name: "AaveV3",
  pool: mcAaveV3Pool,
  lpToken: mcAUSDC
}
