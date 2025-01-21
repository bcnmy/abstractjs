import { inject, test } from "vitest"
import {
  type FundedTestClients,
  type NetworkConfig,
  type NetworkConfigWithBundler,
  initAnvilNetwork,
  initNetwork,
  toFundedTestClients
} from "./testUtils"
import { base, optimism } from "viem/chains"

const MAINNET_CHAINS_FOR_TESTING = [optimism, base]

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

export const toNetwork = async (
  networkType: TestFileNetworkType = "BESPOKE_ANVIL_NETWORK"
): Promise<NetworkConfig> => {
  const forkBaseSepolia =
    networkType === "BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA"
  const communalAnvil = networkType === "COMMUNAL_ANVIL_NETWORK"
  const network = ["TESTNET_FROM_ENV_VARS", "MAINNET_FROM_ENV_VARS"].includes(
    networkType
  )

  return await (communalAnvil
    ? // @ts-ignore
      inject("settings")
    : network
      ? initNetwork(networkType)
      : initAnvilNetwork(forkBaseSepolia))
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
 * @returns The sorted chains of the order: [paymentChain, targetChain]
 * @throws {Error} If the chain is not supported
 */
export const getTestChains = (network: NetworkConfig) => {
  const defaultChainsIncludePaymentChain = MAINNET_CHAINS_FOR_TESTING.some(
    ({ id }) => Number(id) === network.chain.id
  )
  if (defaultChainsIncludePaymentChain) {
    return MAINNET_CHAINS_FOR_TESTING.sort((a, b) =>
      a.id === network.chain.id ? -1 : 1
    )
  }
  throw new Error("Unsupported chain")
}
