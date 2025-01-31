import { base, optimism } from "viem/chains"
import { polygon } from "viem/chains"
import { arbitrum } from "viem/chains"
import type { MultichainToken } from "../../account/utils/Types"
import {
  type MultichainContract,
  getMultichainContract
} from "../../account/utils/getMultichainContract"
import { AavePoolAbi } from "../abi"
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

export type Protocol = {
  name: string
  pool: MultichainContract<typeof AavePoolAbi>
  lpToken: MultichainToken
}

export const aave: Protocol = {
  name: "AaveV3",
  pool: mcAaveV3Pool,
  lpToken: mcAUSDC
}
