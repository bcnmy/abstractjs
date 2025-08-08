import dotenv from "dotenv"
import {
  http,
  type Address,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  publicActions,
  zeroAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import {
  base,
  baseSepolia,
  mainnet,
  optimism,
  optimismSepolia
} from "viem/chains"
import { type MEEVersionConfig, toNexusAccount } from "../src/sdk/account"
import { getChain } from "../src/sdk/account/utils/getChain"
import { MEEVersion, TokenWithPermitAbi } from "../src/sdk/constants"
import { mcUSDC } from "../src/sdk/constants/tokens"
import { getMEEVersion } from "../src/sdk/modules/utils/getMeeConfig"
import { testnetMcTestUSDC, testnetMcTestUSDCP } from "../src/test/testTokens"

dotenv.config()

export const MAINNET_RPC_URLS: Record<number, string> = {
  [mainnet.id]: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  [optimism.id]: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  [base.id]: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
}

export const TESTNET_RPC_URLS: Record<number, string> = {
  [optimismSepolia.id]: `https://opt-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  [baseSepolia.id]: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
}

// Configuration
const NATIVE_TOKEN_AMOUNT = parseEther("0.0005")
const USDC_TOKEN_AMOUNT = parseUnits("3", 6)
const ACCOUNT_INDEX = 0n
const ACCOUNT_INDEX_ONE = 1n

async function main() {
  // Get chain IDs from command line arguments
  const chainIds = process.argv
    .slice(2)
    .map((arg) => Number.parseInt(arg))
    .filter((id) => !Number.isNaN(id))

  if (chainIds.length === 0) {
    console.error(
      "Please provide at least one chain ID as a command line argument"
    )
    console.error("Example: bun run fund:nexus 10 420 84531")
    process.exit(1)
  }

  // Get environment variables
  const { PRIVATE_KEY } = getEnvVars()
  const account = privateKeyToAccount(PRIVATE_KEY)

  console.log("\n=== Master Account ===")
  console.log(`Address: ${account.address}`)

  // Process each chain ID
  for (const chainId of chainIds) {
    // Two account will be available from now. For collision issues in tests, use a fallback account with index one
    // Default: Index zero will be used for most of the tests
    await processChain(chainId, account, {
      accountIndex: ACCOUNT_INDEX,
      version: getMEEVersion(MEEVersion.V2_0_0)
    })
    await processChain(chainId, account, {
      accountIndex: ACCOUNT_INDEX_ONE,
      version: getMEEVersion(MEEVersion.V2_0_0)
    })
    await processChain(chainId, account, {
      accountIndex: ACCOUNT_INDEX,
      version: getMEEVersion(MEEVersion.V2_1_0)
    })
    await processChain(chainId, account, {
      accountIndex: ACCOUNT_INDEX,
      version: getMEEVersion(MEEVersion.V1_1_0)
    })
    await processChain(chainId, account, {
      accountIndex: ACCOUNT_INDEX,
      version: getMEEVersion(MEEVersion.V1_0_0)
    })
  }
}

async function processChain(
  chainId: number,
  account: ReturnType<typeof privateKeyToAccount>,
  nexusParams: {
    accountIndex?: bigint
    version: MEEVersionConfig
  }
) {
  try {
    const chain = getChain(chainId)
    console.log(`\n=== Processing Chain: ${chain.name} (${chainId}) ===`)

    // Determine if this is a testnet or mainnet
    const isTestnet = isTestnetChain(chainId)

    const tokensForFunding: { name: string; address: Address }[] = []

    if (isTestnet) {
      // Always keep the native token as first element
      tokensForFunding.push({
        name: "Testnet Native Currency",
        address: zeroAddress
      })
      tokensForFunding.push({
        name: "Testnet USDC (Non permit)",
        address: testnetMcTestUSDC.addressOn(chainId)
      })
      tokensForFunding.push({
        name: "Testnet USDC (Permit)",
        address: testnetMcTestUSDCP.addressOn(chainId)
      })
    } else {
      // Always keep the native token as first element
      tokensForFunding.push({
        name: "Mainnet Native Currency",
        address: zeroAddress
      })
      tokensForFunding.push({
        name: "Mainnet USDC (Non permit)",
        address: mcUSDC.addressOn(chainId)
      })
    }

    // Check master account balances
    const masterTokenInfoWithBalances = await Promise.all(
      tokensForFunding.map(async (tokenInfo) => {
        return {
          ...tokenInfo,
          chainId,
          balance: (
            await getBalances(
              [{ chainId, tokenAddress: tokenInfo.address }],
              account.address,
              isTestnet
            )
          )[0]
        }
      })
    )

    for (const masterTokenInfoWithBalance of masterTokenInfoWithBalances) {
      if (masterTokenInfoWithBalance.address === zeroAddress) {
        console.log(
          `Master: ${masterTokenInfoWithBalance.name} Balance: ${formatEther(masterTokenInfoWithBalance.balance)}`
        )
      } else {
        console.log(
          `Master: ${masterTokenInfoWithBalance.name} Balance: ${formatUnits(masterTokenInfoWithBalance.balance, 6)}`
        )
      }
    }

    // Create the Nexus account for this chain
    const nexus = await toNexusAccount({
      chainConfiguration: {
        chain,
        transport: isTestnet
          ? http(TESTNET_RPC_URLS[chain.id])
          : http(MAINNET_RPC_URLS[chain.id]),
        version: nexusParams.version
      },
      signer: account,
      index: nexusParams.accountIndex ?? 0n
    })

    const nexusAddress = await nexus.getAddress()
    console.log(`Nexus Account Address: ${nexusAddress}`)

    // Check Nexus account balances
    const nexusTokenInfoWithBalances = await Promise.all(
      tokensForFunding.map(async (tokenInfo) => {
        return {
          ...tokenInfo,
          chainId,
          balance: (
            await getBalances(
              [{ chainId, tokenAddress: tokenInfo.address }],
              nexusAddress,
              isTestnet
            )
          )[0]
        }
      })
    )

    for (const nexusTokenInfoWithBalance of nexusTokenInfoWithBalances) {
      if (nexusTokenInfoWithBalance.address === zeroAddress) {
        console.log(
          `Nexus: ${nexusTokenInfoWithBalance.name} Balance: ${formatEther(nexusTokenInfoWithBalance.balance)}`
        )
      } else {
        console.log(
          `Nexus: ${nexusTokenInfoWithBalance.name} Balance: ${formatUnits(nexusTokenInfoWithBalance.balance, 6)}`
        )
      }
    }

    // Create wallet client for this chain
    const walletClient = createWalletClient({
      account,
      transport: isTestnet
        ? http(TESTNET_RPC_URLS[chain.id])
        : http(MAINNET_RPC_URLS[chain.id]),
      chain
    }).extend(publicActions)

    // Fund with native token if needed
    if (nexusTokenInfoWithBalances[0].balance < NATIVE_TOKEN_AMOUNT) {
      if (masterTokenInfoWithBalances[0].balance < NATIVE_TOKEN_AMOUNT) {
        console.warn(
          `Master: Insufficient ${masterTokenInfoWithBalances[0].name} balance to fund on ${chain.name}`
        )
      } else {
        console.log(
          `Master: Funding Nexus account with ${masterTokenInfoWithBalances[0].name} on ${chain.name}...`
        )
        const nativeTx = await walletClient.sendTransaction({
          to: nexusAddress,
          value: NATIVE_TOKEN_AMOUNT
        })

        const nativeTxReceipt = await walletClient.waitForTransactionReceipt({
          hash: nativeTx
        })
        console.log(
          `${masterTokenInfoWithBalances[0].name} Transaction: ${nativeTxReceipt.transactionHash}`
        )
      }
    } else {
      console.log(
        `Nexus account already has sufficient ${masterTokenInfoWithBalances[0].name} on ${chain.name}`
      )
    }

    // Fund all the ERC20 tokens required for the tests
    for (let i = 1; i < tokensForFunding.length; i++) {
      if (nexusTokenInfoWithBalances[i].balance < USDC_TOKEN_AMOUNT) {
        if (masterTokenInfoWithBalances[i].balance < USDC_TOKEN_AMOUNT) {
          console.warn(
            `Master: Insufficient ${masterTokenInfoWithBalances[i].name} balance on ${chain.name}`
          )
        } else {
          console.log(
            `Master: Funding Nexus account with ${masterTokenInfoWithBalances[i].name} on ${chain.name}...`
          )
          const usdcTx = await walletClient.sendTransaction({
            to: nexusTokenInfoWithBalances[i].address,
            data: encodeFunctionData({
              abi: TokenWithPermitAbi,
              functionName: "transfer",
              args: [nexusAddress, USDC_TOKEN_AMOUNT]
            })
          })

          const usdcTxReceipt = await walletClient.waitForTransactionReceipt({
            hash: usdcTx
          })
          console.log(
            `${masterTokenInfoWithBalances[i].name} Transaction: ${usdcTxReceipt.transactionHash}`
          )
        }
      } else {
        console.log(
          `Nexus account already has sufficient ${masterTokenInfoWithBalances[i].name} on ${
            chain.name
          }. ${formatUnits(nexusTokenInfoWithBalances[i].balance, 6)} USDC`
        )
      }
    }

    console.log(`\n✅ Completed processing for ${chain.name} (${chainId})`)
  } catch (error) {
    console.error(`❌ Error processing chain ${chainId}:`, error)
  }
}

/**
 * Checks if a chain ID belongs to a testnet
 */
function isTestnetChain(chainId: number): boolean {
  // List of common testnet chain IDs
  const testnetChains = [
    5, // Goerli
    420, // Optimism Goerli
    80001, // Polygon Mumbai
    84531, // Base Goerli
    84532, // Base Sepolia
    421613, // Arbitrum Goerli
    421614, // Arbitrum Sepolia
    11155111, // Sepolia
    11155420 // OP Sepolia
  ]
  return testnetChains.includes(Number(chainId))
}

/**
 * Get token balances for an address on a specific chain
 */
const getBalances = async (
  params: {
    chainId: number
    tokenAddress?: Address
  }[],
  address: Address,
  isTestnet: boolean
): Promise<bigint[]> => {
  const results: bigint[] = []

  for (const param of params) {
    const chain = getChain(param.chainId)
    const publicClient = createPublicClient({
      transport: isTestnet
        ? http(TESTNET_RPC_URLS[chain.id])
        : http(MAINNET_RPC_URLS[chain.id]),
      chain
    })
    let balance = 0n
    // Get native token balance
    if (param.tokenAddress === zeroAddress) {
      balance = await publicClient.getBalance({
        address: address
      })
    } else {
      // Get USDC balance if token address is available
      let tokenBalance = 0n
      if (param.tokenAddress) {
        try {
          tokenBalance = await publicClient.readContract({
            address: param.tokenAddress,
            abi: TokenWithPermitAbi,
            functionName: "balanceOf",
            args: [address]
          })
        } catch (error) {
          console.warn(
            `Failed to get token balance for ${param.tokenAddress} on chain ${param.chainId}`
          )
        }
      }
      balance = tokenBalance
    }

    results.push(balance)
  }

  return results
}

/**
 * Get environment variables
 */
const getEnvVars = () => {
  const PRIVATE_KEY = process.env.PRIVATE_KEY
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY is not set in environment variables")
  }
  return {
    PRIVATE_KEY: (PRIVATE_KEY.startsWith("0x")
      ? PRIVATE_KEY
      : `0x${PRIVATE_KEY}`) as `0x${string}`
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
