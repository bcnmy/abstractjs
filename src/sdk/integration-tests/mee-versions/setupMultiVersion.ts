import {
  http,
  type Chain,
  type PublicClient,
  createWalletClient,
  parseEther
} from "viem"
import type { LocalAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import type { MultichainSmartAccount } from "../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../account/toMultiChainNexusAccount"
import type { MeeClient } from "../../clients/createMeeClient"
import { createMeeClient } from "../../clients/createMeeClient"
import { MEEVersion } from "../../constants"
import { getMEEVersion } from "../../modules"

// RPC URLs for testnets
const TESTNET_RPC_URLS: Record<number, string> = {
  [optimismSepolia.id]: `https://opt-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  [baseSepolia.id]: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
}

export type AccountConfig = {
  name: string
  version: MEEVersion
  mcNexus: MultichainSmartAccount
  meeClient: MeeClient
  eoaAccount: LocalAccount
}

export type SetupMultiVersionOptions = {
  eoaAccount: LocalAccount
  versions?: MEEVersion[] // Optional: specify which versions to create
  chains?: Chain[] // Optional: specify which chains
  index?: bigint // Optional: account index (default: 1n)
  apiKey?: string // Optional: API key for the MEE client
}

const MIN_BALANCE = parseEther("0.0005")
const FUNDING_AMOUNT = parseEther("0.001")

/**
 * Funds smart accounts on all chains if their balance is below MIN_BALANCE
 */
async function fundAccountsIfNeeded(
  mcNexus: MultichainSmartAccount,
  eoaAccount: LocalAccount
) {
  for (const deployment of mcNexus.deployments) {
    const chain = deployment.client.chain
    if (!chain) continue

    const publicClient = deployment.client as PublicClient
    const balance = await publicClient.getBalance({
      address: deployment.address
    })

    if (balance < MIN_BALANCE) {
      console.log(
        `Funding ${deployment.address} on ${chain.name} (balance: ${balance})`
      )
      const walletClient = createWalletClient({
        account: eoaAccount,
        chain,
        transport: http(TESTNET_RPC_URLS[chain.id])
      })
      const hash = await walletClient.sendTransaction({
        to: deployment.address,
        value: FUNDING_AMOUNT
      })
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(`Funded ${deployment.address} on ${chain.name} (tx: ${hash})`)
    }
  }
}

/**
 * Creates multi-version account configurations for testing
 * @param options Setup options
 * @returns Array of account configs for each version
 */
export async function setupMultiVersionAccounts(
  options: SetupMultiVersionOptions
): Promise<AccountConfig[]> {
  const {
    eoaAccount,
    versions = [/*MEEVersion.V2_0_0, */ MEEVersion.V2_2_1, MEEVersion.V3_0_0],
    chains = [baseSepolia, optimismSepolia],
    index = 1n,
    apiKey
  } = options

  const accountConfigs: AccountConfig[] = []

  for (const version of versions) {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index,
      chainConfigurations: chains.map((chain: Chain) => ({
        chain,
        transport: http(TESTNET_RPC_URLS[chain.id]),
        version: getMEEVersion(version)
      }))
    })

    await fundAccountsIfNeeded(mcNexus, eoaAccount)

    const meeClient = await createMeeClient({
      account: mcNexus,
      ...(apiKey && { apiKey })
    })

    const versionName =
      version === MEEVersion.V2_0_0
        ? "V2.0.0 (MeeK1, no 712 for simple mode)"
        : version === MEEVersion.V2_2_1
          ? "V2.2.1 (MeeK1, TypedData for simple mode)"
          : version === MEEVersion.V3_0_0
            ? "V3.0.0 (StxValidator)"
            : version

    accountConfigs.push({
      name: versionName,
      version,
      mcNexus,
      meeClient,
      eoaAccount
    })
  }

  return accountConfigs
}

/**
 * Creates account config for a single version
 * Useful when only one version needs testing
 */
export async function setupSingleVersion(
  eoaAccount: LocalAccount,
  version: MEEVersion,
  chains = [baseSepolia, optimismSepolia]
): Promise<AccountConfig> {
  const configs = await setupMultiVersionAccounts({
    eoaAccount,
    versions: [version],
    chains
  })
  return configs[0]
}
