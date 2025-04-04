import { http, type Prettify, type Transport } from "viem"
import { type Chain, arbitrum, avalanche, base, baseSepolia, bsc, gnosis, mainnet, optimism, optimismSepolia, polygon, sonic, sonic } from "viem/chains"
import { inject, test } from "vitest"
import {
  BASE_SEPOLIA_RPC_URL,
  type NetworkConfig,
  initEcosystem,
  initNetwork
} from "./testUtils"

//// Base Sepolia
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [baseSepolia, baseSepolia]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// Sonic
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [sonic, sonic]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://sonic-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// Gnosis
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [gnosis, gnosis]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://gnosis-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://gnosis-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// BSC
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [bsc, bsc]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://bnb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// Polygon
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [polygon, polygon]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// Mainnet
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [mainnet, mainnet]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// Base
const MAINNET_CHAINS_FOR_TESTING: Chain[] = [base, base]
const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
  http(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  http(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
]

//// Optimism
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [optimism, optimism]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [avalanche, avalanche]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://avax-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://avax-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

//// Arbitrum
// const MAINNET_CHAINS_FOR_TESTING: Chain[] = [arbitrum, arbitrum]
// const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
//   http(`https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
//   http(`https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
// ]

export const testnetTest = test.extend<{
  config: NetworkConfig
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Needed in vitest :/
  config: async ({}, use) => {
    const testNetwork = await toNetwork("TESTNET_FROM_ENV_VARS")
    await use(testNetwork)
  }
})

export type TestFileNetworkType =
  | "BESPOKE_ANVIL_NETWORK"
  | "BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA"
  | "TESTNET_FROM_ENV_VARS"
  | "MAINNET_FROM_ENV_VARS"
  | "COMMUNAL_ANVIL_NETWORK"

type PrettifiedNetworkConfig = Prettify<NetworkConfig>
export const toNetwork = async (
  networkType: TestFileNetworkType = "BESPOKE_ANVIL_NETWORK"
): Promise<NetworkConfig> => {
  const forkBaseSepolia =
    networkType === "BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA"
  const communalAnvil = networkType === "COMMUNAL_ANVIL_NETWORK"
  const network = ["TESTNET_FROM_ENV_VARS", "MAINNET_FROM_ENV_VARS"].includes(
    networkType
  )

  return await initNetwork("TESTNET_FROM_ENV_VARS")
}

export const paymasterTruthy = () => {
  try {
    return !!process.env.PAYMASTER_URL
  } catch (e) {
    return false
  }
}

/**
 * Sorts the chains for testing, throwing an error if the chain is not supported
 * @param network - The network configuration
 * @returns The sorted chains of the order: [optimism, base]
 * @throws {Error} If the chain is not supported
 */
export const getTestChainConfig = (
  network: NetworkConfig
): [Chain[], Transport[]] => {
  const defaultChainsIncludePaymentChain = MAINNET_CHAINS_FOR_TESTING.some(
    ({ id }) => Number(id) === network.chain.id
  )
  if (defaultChainsIncludePaymentChain) {
    const pairedChains = MAINNET_CHAINS_FOR_TESTING.map((chain, i) => ({
      chain,
      transport: MAINNET_TRANSPORTS_FOR_TESTING[i]
    }))
    const sortedPairedChains = pairedChains.sort((a, b) =>
      a.chain.id === network.chain.id ? -1 : 1
    )
    const sortedChains = sortedPairedChains.map(({ chain }) => chain)
    const sortedTransports = sortedPairedChains.map(
      ({ transport }) => transport
    )
    return [sortedChains, sortedTransports]
  }
  throw new Error("Unsupported chain")
}

export type { NetworkConfig }
