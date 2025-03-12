import dotenv from "dotenv"
import {
  http,
  type Address,
  type Chain,
  type Hex,
  type Transport,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  publicActions
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, optimism } from "viem/chains"
import { toMultichainNexusAccount, toNexusAccount } from "../src/sdk/account"
import { getChain } from "../src/sdk/account/utils/getChain"
import { TokenWithPermitAbi } from "../src/sdk/constants"
import { mcUSDC, testnetMcUSDC } from "../src/sdk/constants/tokens"

dotenv.config()

type EnvVars = {
  MAINNET_CHAIN_ID: number
  PRIVATE_KEY: Hex
  TESTNET_CHAIN_ID: number
}
const NATIVE_TOKEN_AMOUNT = parseEther("0.001")
const USDC_TOKEN_AMOUNT = parseUnits("1", 6)
const index = 0n

async function main() {
  const { MAINNET_CHAIN_ID, PRIVATE_KEY, TESTNET_CHAIN_ID } = getEnvVars()
  const mainnetUsdc = mcUSDC.addressOn(+MAINNET_CHAIN_ID)
  const chain = getChain(MAINNET_CHAIN_ID)
  const testnetChain = getChain(TESTNET_CHAIN_ID)
  const account = privateKeyToAccount(PRIVATE_KEY)

  // Check balances
  console.log("\n=== Master Account ===")
  console.log(`Address: ${account.address}`)
  const [masterNativeBalance, masterUsdcBalance] = await getBalances(
    { chainId: MAINNET_CHAIN_ID, tokenAddress: mainnetUsdc },
    account.address
  )

  console.log(`Network: ${chain.name}`)
  console.log(`Native Token Balance: ${formatEther(masterNativeBalance)} ETH`)
  console.log(`USDC Balance: ${formatUnits(masterUsdcBalance, 6)} USDC`)

  if (masterNativeBalance < NATIVE_TOKEN_AMOUNT) {
    throw new Error("Native token balance is less than 0.001 ETH")
  }
  if (masterUsdcBalance < USDC_TOKEN_AMOUNT) {
    throw new Error("USDC balance is less than 1 USDC")
  }

  console.log("\n=== MEE Nexus Account ===")
  const chains = [optimism, base]
  const transports: Transport[] = [http(), http()]

  const mcNexus = await toMultichainNexusAccount({
    signer: account,
    chains,
    transports,
    index
  })

  const mcNexusAddress = await mcNexus
    .deploymentOn(optimism.id, true)
    .getAddress()

  console.log(`Address: ${mcNexusAddress}`)
  console.log(`Network: ${optimism.name}`)

  const [meeNexusNativeBalance, usdcNexusBalance] = await getBalances(
    { chainId: MAINNET_CHAIN_ID, tokenAddress: mainnetUsdc },
    mcNexusAddress
  )

  console.log(`Native Token Balance: ${formatEther(meeNexusNativeBalance)} ETH`)
  console.log(`USDC Balance: ${formatUnits(usdcNexusBalance, 6)} USDC`)

  const masterClient = createWalletClient({
    account,
    transport: http(),
    chain: optimism
  }).extend(publicActions)

  if (meeNexusNativeBalance >= NATIVE_TOKEN_AMOUNT) {
    console.log(
      `MEE Nexus (${mcNexusAddress}) Native Token Balance already funded`
    )
  } else {
    const nativeTx = await masterClient.sendTransaction({
      to: mcNexusAddress,
      value: NATIVE_TOKEN_AMOUNT
    })

    const nativeTxReceipt = await masterClient.waitForTransactionReceipt({
      hash: nativeTx
    })
    console.log("Native Transaction:", nativeTxReceipt.transactionHash)
  }

  if (usdcNexusBalance >= USDC_TOKEN_AMOUNT) {
    console.log(`MEE Nexus (${mcNexusAddress}) USDC Balance already funded`)
  } else {
    const usdcTx = await masterClient.sendTransaction({
      to: mainnetUsdc,
      data: encodeFunctionData({
        abi: TokenWithPermitAbi,
        functionName: "transfer",
        args: [mcNexusAddress, USDC_TOKEN_AMOUNT]
      })
    })

    const usdcTxReceipt = await masterClient.waitForTransactionReceipt({
      hash: usdcTx
    })
    console.log("USDC Transaction:", usdcTxReceipt.transactionHash)
  }

  console.log("\n=== Vanilla Nexus Account ===")
  const testnetClient = createWalletClient({
    account,
    transport: http(),
    chain: testnetChain
  }).extend(publicActions)

  const vanillaNexus = await toNexusAccount({
    chain: testnetChain,
    signer: account,
    transport: http(),
    index
  })

  const vanillaNexusAddress = await vanillaNexus.getAddress()
  const testnetUsdc = testnetMcUSDC.addressOn(TESTNET_CHAIN_ID)

  console.log(`Address: ${vanillaNexusAddress}`)
  console.log(`Network: ${testnetChain.name}`)

  console.log(
    "Vanilla Nexus Address:",
    vanillaNexusAddress,
    "on testnet chain",
    testnetChain.name
  )

  const [vanillaNexusNativeBalance, vanillaNexusUsdcBalance] =
    await getBalances(
      {
        chainId: TESTNET_CHAIN_ID,
        tokenAddress: testnetUsdc
      },
      vanillaNexusAddress
    )

  console.log(
    `Native Token Balance: ${formatEther(vanillaNexusNativeBalance)} ETH`
  )
  console.log(`USDC Balance: ${formatUnits(vanillaNexusUsdcBalance, 6)} USDC`)

  if (vanillaNexusNativeBalance >= NATIVE_TOKEN_AMOUNT) {
    console.log(
      `Vanilla Nexus Native Token Balance already funded on testnet chain ${testnetChain.name}`
    )
  } else {
    const nativeTx = await testnetClient.sendTransaction({
      to: vanillaNexusAddress,
      value: NATIVE_TOKEN_AMOUNT
    })
    const vanillaNexusUsdcTxReceipt =
      await testnetClient.waitForTransactionReceipt({
        hash: nativeTx
      })
    console.log(
      `Vanilla Nexus USDC Transaction on testnet chain ${testnetChain.name}:`,
      vanillaNexusUsdcTxReceipt.transactionHash
    )
  }

  if (vanillaNexusUsdcBalance >= USDC_TOKEN_AMOUNT) {
    console.log(
      `Vanilla Nexus USDC Balance already funded on testnet chain ${testnetChain.name}`
    )
  } else {
    const vanillaNexusUsdcTx = await testnetClient.sendTransaction({
      to: testnetUsdc,
      data: encodeFunctionData({
        abi: TokenWithPermitAbi,
        functionName: "transfer",
        args: [vanillaNexusAddress, USDC_TOKEN_AMOUNT]
      })
    })
    const vanillaNexusUsdcTxReceipt =
      await testnetClient.waitForTransactionReceipt({
        hash: vanillaNexusUsdcTx
      })
    console.log(
      "Vanilla Nexus USDC Transaction:",
      vanillaNexusUsdcTxReceipt.transactionHash
    )
  }
}

const getBalances = async (
  envVars: {
    chainId: number
    tokenAddress: Address
  },
  address: Address
): Promise<[bigint, bigint]> => {
  const chain = getChain(envVars.chainId)
  const publicClient = createPublicClient({ transport: http(), chain })
  return await Promise.all([
    publicClient.getBalance({
      address: address
    }),
    publicClient.readContract({
      address: envVars.tokenAddress,
      abi: TokenWithPermitAbi,
      functionName: "balanceOf",
      args: [address]
    })
  ])
}

const getEnvVars = (): EnvVars => {
  const MAINNET_CHAIN_ID = process.env.MAINNET_CHAIN_ID
  const PRIVATE_KEY = process.env.PRIVATE_KEY
  const TESTNET_CHAIN_ID = process.env.TESTNET_CHAIN_ID
  if (!MAINNET_CHAIN_ID || !PRIVATE_KEY || !TESTNET_CHAIN_ID) {
    throw new Error(
      "MAINNET_CHAIN_ID or PRIVATE_KEY or TESTNET_CHAIN_ID is not set"
    )
  }
  return {
    MAINNET_CHAIN_ID: Number(MAINNET_CHAIN_ID),
    PRIVATE_KEY: `0x${PRIVATE_KEY}`,
    TESTNET_CHAIN_ID: Number(TESTNET_CHAIN_ID)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
