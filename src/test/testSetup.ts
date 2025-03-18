import {
  deployContracts as deployEcosystemContracts,
  toBundler as toEcosystemBundler,
  toNetwork as toEcosystemNetwork
} from "@biconomy/ecosystem"
import { http, type Prettify, type Transport } from "viem"
import { type Chain, base, optimism } from "viem/chains"
import { test } from "vitest"
import {
  type FundedTestClients,
  type NetworkConfig,
  type NetworkConfigWithBundler,
  initAnvilNetwork,
  initNetwork,
  toFundedTestClients
} from "./testUtils"

const MAINNET_CHAINS_FOR_TESTING: Chain[] = [optimism, base]
const MAINNET_TRANSPORTS_FOR_TESTING: Transport[] = [
  http(`https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`),
  http(`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
]

export type NetworkConfigWithTestClients = NetworkConfigWithBundler & {
  fundedTestClients: FundedTestClients
}

export const localhostTest = test.extend<{
  config: NetworkConfigWithTestClients
}>({
  // biome-ignore lint/correctness/noEmptyPattern: Needed in vitest :/
  config: async ({}, use) => {
    const testNetwork = await initAnvilNetwork()
    const fundedTestClients = await toFundedTestClients({
      chain: testNetwork.chain,
      bundlerUrl: testNetwork.bundlerUrl
    })
    await use({ ...testNetwork, fundedTestClients })
    await Promise.all([
      testNetwork.instance.stop(),
      testNetwork.bundlerInstance.stop()
    ])
  }
})

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

export const toNetworks = async (
  networkTypes_: TestFileNetworkType | TestFileNetworkType[] = [
    "BESPOKE_ANVIL_NETWORK"
  ]
): Promise<NetworkConfig[]> => {
  const networkTypes = Array.isArray(networkTypes_)
    ? networkTypes_
    : [networkTypes_]

  return await Promise.all(networkTypes.map((type) => toNetwork(type)))
}

type PrettifiedNetworkConfig = Prettify<NetworkConfig>
export const toNetwork = async (
  networkType: TestFileNetworkType = "BESPOKE_ANVIL_NETWORK"
): Promise<PrettifiedNetworkConfig> => {
  switch (networkType) {
    case "BESPOKE_ANVIL_NETWORK":
    case "COMMUNAL_ANVIL_NETWORK": {
      const network = await toEcosystemNetwork()
      await deployEcosystemContracts(network)
      const bundler = await toEcosystemBundler(network)

      const result: PrettifiedNetworkConfig = {
        ...network,
        bundlerUrl: bundler.url,
        bundlerPort: bundler.port
      }

      console.log(Object.keys(result))
      return result
    }
    case "BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA": {
      return await initAnvilNetwork(true)
    }
    case "TESTNET_FROM_ENV_VARS": {
      return await initNetwork(networkType)
    }
    case "MAINNET_FROM_ENV_VARS": {
      return await initNetwork(networkType)
    }
  }
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
