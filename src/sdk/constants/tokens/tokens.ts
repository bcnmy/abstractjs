import { erc20Abi } from "viem"
import {
  arbitrum,
  avalanche,
  gnosis,
  mainnet,
  metis,
  optimism,
  polygon
} from "viem/chains"
import { getMultichainContract } from "../../account/utils/getMultichainContract"

export const mcAUSDC = getMultichainContract<typeof erc20Abi>({
  abi: erc20Abi,
  deployments: [
    ["0x98c23e9d8f34fefb1b7bd6a91b7ff122f4e16f5c", mainnet.id],
    ["0xc6b7aca6de8a6044e0e32d0c841a89244a10d284", gnosis.id],
    ["0x625e7708f30ca75bfd92586e17077590c60eb4cd", optimism.id],
    ["0x885c8aec5867571582545f894a5906971db9bf27", metis.id],
    ["0x724dc807b04555b71ed48a6896b6f41593b8c637", arbitrum.id],
    ["0x625e7708f30ca75bfd92586e17077590c60eb4cd", polygon.id],
    ["0x625e7708f30ca75bfd92586e17077590c60eb4cd", avalanche.id]
  ]
})
