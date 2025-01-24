import { base, optimism } from "viem/chains"
import {
  getMultichainContract,
  type MultichainContract
} from "../../account/utils/getMultichainContract"
import { polygon } from "viem/chains"
import { arbitrum } from "viem/chains"
import { AaveV3PoolAbi } from "../abi/AaveV3Pool"
import { mcAUSDC } from "../tokens"
import type { MultichainToken } from "../../account/utils/Types"

export const mcAaveV3Pool = getMultichainContract<typeof AaveV3PoolAbi>({
  abi: AaveV3PoolAbi,
  deployments: [
    ["0x794a61358D6845594F94dc1DB02A252b5b4814aD", optimism.id],
    ["0xA238Dd80C259a72e81d7e4664a9801593F98d1c5", base.id],
    ["0x794a61358D6845594F94dc1DB02A252b5b4814aD", polygon.id],
    ["0x794a61358D6845594F94dc1DB02A252b5b4814aD", arbitrum.id]
  ]
})

export type Protocol = {
  name: string
  pool: MultichainContract<typeof AaveV3PoolAbi>
  lpToken: MultichainToken
}

export const aave: Protocol = {
  name: "AaveV3",
  pool: mcAaveV3Pool,
  lpToken: mcAUSDC
}
