import { toEcosystem } from "@biconomy/ecosystem"
import { config } from "dotenv"
import type { alto, anvil } from "prool/instances"
import {
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type Transport,
  type WalletClient,
  createTestClient,
  erc20Abi,
  parseAbi,
  publicActions,
  walletActions,
  zeroAddress
} from "viem"
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { getChain, getCustomChain } from "../sdk/account/utils"
import { Logger } from "../sdk/account/utils/Logger"
import type { NexusClient } from "../sdk/clients/createBicoBundlerClient"
import type { AnyData } from "../sdk/modules/utils/Types"
import {
  MAINNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  type TestFileNetworkType
} from "./testSetup"

config()

export const BASE_SEPOLIA_RPC_URL =
  "https://virtual.base-sepolia.rpc.tenderly.co/3c4d2e0f-2d96-457e-bbfe-02c5b60c0cf1"

const TESTNET_RPC_URLS: Record<number, string> = {
  [optimismSepolia.id]: `https://opt-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  [baseSepolia.id]: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
}

type AnvilInstance = ReturnType<typeof anvil>
type BundlerInstance = ReturnType<typeof alto>
type BundlerDto = {
  bundlerInstance: BundlerInstance
  bundlerUrl: string
  bundlerPort: number
}
export type AnvilDto = {
  rpcUrl: string
  rpcPort: number
  chain: Chain
  instance: AnvilInstance
}
export type NetworkConfigWithBundler = AnvilDto & BundlerDto
export type NetworkConfig = Omit<
  NetworkConfigWithBundler,
  "instance" | "bundlerInstance"
> & {
  account?: LocalAccount
  accountTwo?: LocalAccount
  paymasterUrl?: string
  meeNodeUrl?: string
}

export const pKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" // This is a publicly available private key meant only for testing only

export const getTestAccount = (
  addressIndex = 0
): ReturnType<typeof mnemonicToAccount> => {
  return mnemonicToAccount(
    "test test test test test test test test test test test junk",
    {
      addressIndex
    }
  )
}

// Declare a global variable to store excluded ports
declare global {
  var __ECOSYSTEM_INSTANCES__: Map<number, AnvilInstance>
}

// Initialize the global variable if it doesn't exist
if (!global.__ECOSYSTEM_INSTANCES__) {
  global.__ECOSYSTEM_INSTANCES__ = new Map<number, AnvilInstance>()
}

export type DeployerParams = {
  name?: string
  chainId: number
  address: Address
}

export const killAllNetworks = () =>
  killNetwork(Array.from(global.__ECOSYSTEM_INSTANCES__.keys()))

export const killNetwork = (ids: number[]) =>
  Promise.all(
    ids.map(async (id) => {
      const instance = global.__ECOSYSTEM_INSTANCES__.get(id)
      if (instance) {
        await instance.stop()
        global.__ECOSYSTEM_INSTANCES__.delete(id)
      }
    })
  )

export const initNetwork = async (
  type: TestFileNetworkType = "TESTNET_FROM_ENV_VARS"
): Promise<NetworkConfig> => {
  const privateKey = process.env.PRIVATE_KEY
  const privateKeyTwo = process.env.PRIVATE_KEY_TWO
  const chainId_ = process.env.TESTNET_CHAIN_ID
  const mainnetChainId = process.env.MAINNET_CHAIN_ID
  const _bundlerUrl = process.env.BUNDLER_URL // Optional, taken from chain (using chainId) if not provided
  const paymasterUrl = process.env.PAYMASTER_URL // Optional
  const chainId = type === "MAINNET_FROM_ENV_VARS" ? mainnetChainId : chainId_

  let chain: Chain

  if (!privateKey) throw new Error("Missing env var PRIVATE_KEY")
  if (!privateKeyTwo) throw new Error("Missing env var PRIVATE_KEY_TWO")
  if (!chainId) throw new Error("Missing env var TESTNET_CHAIN_ID")

  try {
    chain = getChain(+chainId)
  } catch (e) {
    throw new Error("Failed to find the chain")
  }

  const bundlerUrl = _bundlerUrl ?? getBundlerUrl(+chainId)

  const holder = privateKeyToAccount(
    privateKey?.startsWith("0x") ? (privateKey as Hex) : `0x${privateKey}`
  )
  const holderTwo = privateKeyToAccount(
    privateKeyTwo?.startsWith("0x")
      ? (privateKeyTwo as Hex)
      : `0x${privateKeyTwo}`
  )

  const rpcUrl =
    TESTNET_RPC_URLS[+chainId] ??
    MAINNET_RPC_URLS[+chainId] ??
    chain.rpcUrls.default.http[0]

  return {
    rpcUrl,
    rpcPort: 0,
    chain,
    bundlerUrl,
    paymasterUrl,
    bundlerPort: 0,
    account: holder,
    accountTwo: holderTwo
  }
}

export const initEcosystem = async ({ forkUrl }: { forkUrl?: string } = {}) => {
  const {
    infras: [{ network, bundler }]
  } = await toEcosystem({ forkUrl })

  global.__ECOSYSTEM_INSTANCES__.set(bundler.port, bundler.instance)
  global.__ECOSYSTEM_INSTANCES__.set(network.rpcPort, network.instance)

  const result = {
    ...network,
    chain: network.chain as Chain,
    account: privateKeyToAccount(network.privateKey),
    accountTwo: mnemonicToAccount(
      "test test test test test test test test test test test junk",
      {
        addressIndex: 1
      }
    ),
    bundlerInstance: bundler.instance,
    bundlerUrl: bundler.url,
    bundlerPort: bundler.port
  }
  return result
}

export type MasterClient = ReturnType<typeof toTestClient>
export const toTestClient = (chain: Chain, account: Account) =>
  createTestClient({
    mode: "anvil",
    chain,
    account,
    transport: http()
  })
    .extend(publicActions)
    .extend(walletActions)

export const getBalance = async (
  testClient: AnyData,
  owner: Hex,
  tokenAddress?: Hex
): Promise<bigint> => {
  if (!tokenAddress) {
    return await testClient.getBalance({ address: owner })
  }
  return await testClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner]
  })
}

export const nonZeroBalance = async (
  testClient: MasterClient,
  address: Hex,
  tokenAddress?: Hex
) => {
  const balance = await getBalance(testClient, address, tokenAddress)
  if (balance > BigInt(0)) return
  throw new Error(
    `Insufficient balance ${
      tokenAddress ? `of token ${tokenAddress}` : "of native token"
    } during test setup of owner: ${address}`
  )
}

export const fundAndDeployClients = async (
  testClient: MasterClient,
  nexusClients: NexusClient[]
) => {
  return await Promise.all(
    nexusClients.map(async (nexusClient) => {
      await fundAndDeploySingleClient(testClient, nexusClient)
    })
  )
}

export const fundAndDeploySingleClient = async (
  testClient: MasterClient,
  nexusClient: NexusClient
) => {
  try {
    const accountAddress = await nexusClient.account.getAddress()
    await topUp(testClient, accountAddress)

    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: zeroAddress,
          value: 0n
        }
      ]
    })

    const {
      success,
      receipt: { transactionHash }
    } = await nexusClient.waitForUserOperationReceipt({
      hash
    })
    if (!success) {
      throw new Error("Failed to deploy smart account")
    }
    await testClient.waitForTransactionReceipt({ hash: transactionHash })
    return transactionHash
  } catch (e) {
    console.error(`Error initializing smart account: ${e}`)
    return Promise.resolve()
  }
}

export const safeTopUp = async (
  testClient: MasterClient,
  recipient: Hex,
  amount = 100000000000000000000n,
  token?: Hex
) => {
  try {
    return await topUp(testClient, recipient, amount, token)
  } catch (error) {}
}

export const topUp = async (
  testClient: MasterClient,
  recipient: Hex,
  amount = 10000000000000000n,
  token?: Hex
) => {
  const balanceOfRecipient = await getBalance(testClient, recipient, token)

  if (balanceOfRecipient > amount) {
    Logger.log(
      `balanceOfRecipient (${recipient}) already has enough ${
        token ?? "native token"
      } (${balanceOfRecipient}) during safeTopUp`
    )
    return await Promise.resolve()
  }

  if (token) {
    const hash = await testClient.writeContract({
      address: token,
      abi: parseAbi([
        "function transfer(address recipient, uint256 amount) external"
      ]),
      functionName: "transfer",
      args: [recipient, amount]
    })
    return await testClient.waitForTransactionReceipt({ hash })
  }
  const hash = await testClient.sendTransaction({
    to: recipient,
    value: amount
  })
  return await testClient.waitForTransactionReceipt({ hash })
}

export const getBundlerUrl = (chainId: number) =>
  `https://bundler.biconomy.io/api/v3/${chainId}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f14`

/**
 * Get the allowance of a token for an owner and spender
 */
export const getAllowance = async ({
  publicClient,
  tokenAddress,
  owner,
  spender
}: {
  publicClient: PublicClient
  tokenAddress: Address
  owner: Address
  spender: Address
}) => {
  return await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender]
  })
}

/**
 * Set the allowance of a token for an owner and spender
 */
export const setAllowance = async ({
  publicClient,
  walletClient,
  tokenAddress,
  spender,
  amount
}: {
  publicClient: PublicClient
  walletClient: WalletClient<Transport, Chain, Account>
  tokenAddress: Address
  spender: Address
  amount: bigint
}) => {
  const allowanceTxHash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount]
  })
  return await publicClient.waitForTransactionReceipt({
    hash: allowanceTxHash,
    confirmations: TEST_BLOCK_CONFIRMATIONS
  })
}

/**
 * Transfer an ERC20 token
 */
export const transferErc20 = async ({
  publicClient,
  walletClient,
  tokenAddress,
  recipient,
  amount
}: {
  publicClient: PublicClient
  walletClient: WalletClient<Transport, Chain, Account>
  tokenAddress: Address
  recipient: Address
  amount: bigint
}) => {
  const hash = await walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amount]
  })
  return await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: TEST_BLOCK_CONFIRMATIONS
  })
}

export const getRandomAccountIndex = (min: number, max: number) => {
  const minValue = Math.ceil(min) // Round up to ensure inclusive min
  const maxValue = Math.floor(max) // Round down to ensure inclusive max
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
}
