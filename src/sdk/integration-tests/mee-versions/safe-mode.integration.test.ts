/**
 * Safe Account Mode Integration Tests
 *
 * Tests Safe multisig as master account for supertransactions via MEE V3.0.0.
 * Safe account mode characteristics:
 * - Uses meeClient.getSafeQuote() + signSafeQuote + executeSignedQuote flow
 * - Safe multisig signs an approval transaction (trigger)
 * - SafeAccountSubmodule on the StxValidator validates and executes the Safe trigger on-chain
 * - Uses testnetMcTestUSDCP (permit-enabled) as the trigger token
 * - Requires Safe deployment on all involved chains
 * - Requires 2-of-2 multisig signing via @safe-global/protocol-kit
 *
 * Test matrix (4 cases):
 * - 4 combinations of sponsorship (yes/no) and simulation (yes/no)
 *
 * Tested version: V3.0.0
 * Testnets: Base Sepolia, Optimism Sepolia
 */

import Safe from "@safe-global/protocol-kit"
import {
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type Transport,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  encodePacked
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  toNetwork
} from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import type { MultichainSmartAccount } from "../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../account/toMultiChainNexusAccount"
import {
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../clients/createMeeClient"
import { executeSignedQuote } from "../../clients/decorators/mee/executeSignedQuote"
import type { GetSafeQuoteParams } from "../../clients/decorators/mee/getSafeQuote"
import { getMeeVersionsForQuote } from "../../clients/decorators/mee/signQuote"
import {
  getDataToPrepareSafeTransaction,
  getMockSafeSigner
} from "../../clients/decorators/mee/signSafeQuote"
import { MEEVersion } from "../../constants"
import { getMEEVersion } from "../../modules"

const modes = [
  {
    sponsored: false,
    simulated: false,
    label: "no sponsorship, no simulation"
  },
  { sponsored: true, simulated: false, label: "sponsored, no simulation" },
  { sponsored: false, simulated: true, label: "no sponsorship, simulated" },
  { sponsored: true, simulated: true, label: "sponsored, simulated" }
]

const baseSepoliaRpcUrl = TESTNET_RPC_URLS[baseSepolia.id]
const opSepoliaRpcUrl = TESTNET_RPC_URLS[optimismSepolia.id]

const TRIGGER_TOKEN_ADDRESS = testnetMcTestUSDCP.addressOn(baseSepolia.id)
const OP_SEPOLIA_TOKEN_ADDRESS = testnetMcTestUSDCP.addressOn(
  optimismSepolia.id
)
const TRIGGER_AMOUNT = 123000n // 0.123 USDCP (6 decimals)
const TRANSFER_AMOUNT = 10000n // 0.01 USDCP (6 decimals)

function buildGetSafeQuoteParams(
  mcNexus: MultichainSmartAccount,
  safeAddress: Address,
  recipientAddress: Address,
  options: { sponsored: boolean; simulated: boolean }
): GetSafeQuoteParams {
  const trigger = {
    tokenAddress: TRIGGER_TOKEN_ADDRESS,
    chainId: baseSepolia.id,
    amount: TRIGGER_AMOUNT
  }

  const instructions = [
    mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: TRIGGER_TOKEN_ADDRESS,
        amount: TRANSFER_AMOUNT,
        chainId: baseSepolia.id,
        recipient: recipientAddress
      }
    }),
    mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: OP_SEPOLIA_TOKEN_ADDRESS,
        amount: TRANSFER_AMOUNT,
        chainId: optimismSepolia.id,
        recipient: recipientAddress
      }
    })
  ]

  const simulation = options.simulated
    ? { simulate: true as const }
    : undefined

  if (options.sponsored) {
    return {
      trigger,
      instructions,
      safeAccount: safeAddress,
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      ...(simulation && { simulation })
    }
  }

  return {
    trigger,
    instructions,
    safeAccount: safeAddress,
    feeToken: {
      address: TRIGGER_TOKEN_ADDRESS,
      chainId: baseSepolia.id
    },
    ...(simulation && { simulation })
  }
}

describe("Safe Account Mode Integration Tests", () => {
  let safeAddress: Address
  let protocolKitOwner1: Safe
  let protocolKitOwner2: Safe
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let recipientAddress: Address

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    const eoaAccount = network.account!
    const eoaAccountTwo = network.accountTwo!

    recipientAddress = privateKeyToAccount(generatePrivateKey()).address

    const privateKey = process.env.PRIVATE_KEY as Hex
    const privateKeyTwo = process.env.PRIVATE_KEY_TWO as Hex

    if (!privateKey || !privateKeyTwo) {
      throw new Error("PRIVATE_KEY and PRIVATE_KEY_TWO must be set")
    }

    const formattedPrivateKey = privateKey.startsWith("0x")
      ? privateKey
      : (`0x${privateKey}` as Hex)
    const formattedPrivateKeyTwo = privateKeyTwo.startsWith("0x")
      ? privateKeyTwo
      : (`0x${privateKeyTwo}` as Hex)

    const baseSepoliaPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(baseSepoliaRpcUrl)
    })

    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(baseSepoliaRpcUrl)
    }) as ReturnType<typeof createWalletClient<Transport, Chain, Account>>

    const opSepoliaPublicClient = createPublicClient({
      chain: optimismSepolia,
      transport: http(opSepoliaRpcUrl)
    })

    const opSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: optimismSepolia,
      transport: http(opSepoliaRpcUrl)
    }) as ReturnType<typeof createWalletClient<Transport, Chain, Account>>

    // Step 1: Setup Safe account with 2 signers and threshold 2
    const safeAccountConfig = {
      owners: [eoaAccount.address, eoaAccountTwo.address],
      threshold: 2
    }

    const safeDeploymentConfig = {
      saltNonce: "0",
      safeVersion: "1.4.1" as const
    }

    const predictedSafe = {
      safeAccountConfig,
      safeDeploymentConfig
    }

    protocolKitOwner1 = await Safe.init({
      provider: baseSepoliaRpcUrl,
      signer: formattedPrivateKey,
      predictedSafe
    })

    const predictedSafeAddress =
      (await protocolKitOwner1.getAddress()) as Address

    // Deploy Safe on Base Sepolia if needed
    const safeCode = await baseSepoliaPublicClient.getCode({
      address: predictedSafeAddress
    })
    const isDeployed = safeCode !== undefined && safeCode !== "0x"

    if (!isDeployed) {
      console.log("Deploying Safe on Base Sepolia:", predictedSafeAddress)
      const deploymentTransaction =
        await protocolKitOwner1.createSafeDeploymentTransaction()

      const txHash = await baseSepoliaWalletClient.sendTransaction({
        to: deploymentTransaction.to as Address,
        data: deploymentTransaction.data as Hex,
        value: BigInt(deploymentTransaction.value),
        chain: baseSepolia
      })
      await baseSepoliaPublicClient.waitForTransactionReceipt({ hash: txHash })
      console.log("Safe deployed on Base Sepolia at:", predictedSafeAddress)
    }

    safeAddress = predictedSafeAddress

    // Deploy Safe on OP Sepolia if needed
    const safeCodeOpSepolia = await opSepoliaPublicClient.getCode({
      address: predictedSafeAddress
    })
    const isDeployedOnOpSepolia =
      safeCodeOpSepolia !== undefined && safeCodeOpSepolia !== "0x"

    if (!isDeployedOnOpSepolia) {
      console.log("Deploying Safe on OP Sepolia...")
      const protocolKitOpSepolia = await Safe.init({
        provider: opSepoliaRpcUrl,
        signer: formattedPrivateKey,
        predictedSafe
      })

      const predictedAddressOpSepolia =
        await protocolKitOpSepolia.getAddress()
      if (predictedAddressOpSepolia !== predictedSafeAddress) {
        throw new Error(
          `Safe address mismatch! Base Sepolia: ${predictedSafeAddress}, OP Sepolia: ${predictedAddressOpSepolia}`
        )
      }

      const deploymentTransactionOpSepolia =
        await protocolKitOpSepolia.createSafeDeploymentTransaction()

      const txHashOpSepolia = await opSepoliaWalletClient.sendTransaction({
        to: deploymentTransactionOpSepolia.to as Address,
        data: deploymentTransactionOpSepolia.data as Hex,
        value: BigInt(deploymentTransactionOpSepolia.value),
        chain: optimismSepolia
      })
      await opSepoliaPublicClient.waitForTransactionReceipt({
        hash: txHashOpSepolia
      })
      console.log("Safe deployed on OP Sepolia at:", predictedSafeAddress)
    }

    // Re-initialize protocol kits with deployed Safe address
    protocolKitOwner1 = await Safe.init({
      provider: baseSepoliaRpcUrl,
      signer: formattedPrivateKey,
      safeAddress
    })

    protocolKitOwner2 = await Safe.init({
      provider: baseSepoliaRpcUrl,
      signer: formattedPrivateKeyTwo,
      safeAddress
    })

    // Step 2: Create Nexus orchestrator owned by Safe (V3.0.0)
    const safeSigner = getMockSafeSigner(safeAddress)

    mcNexus = await toMultichainNexusAccount({
      signer: safeSigner,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(baseSepoliaRpcUrl),
          version: getMEEVersion(MEEVersion.V3_0_0)
        },
        {
          chain: optimismSepolia,
          transport: http(opSepoliaRpcUrl),
          version: getMEEVersion(MEEVersion.V3_0_0)
        }
      ],
      defaultModuleParameters: {
        statelessValidator: getMEEVersion(MEEVersion.V3_0_0).submodules?.SafeAccountSubmodule as Address,
        ownershipData: encodePacked(["address"], [safeAddress])
      }
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const nexusAddressOnOpSepolia = mcNexus.addressOn(optimismSepolia.id, true)

    // Step 3: Fund Safe with USDCP on Base Sepolia if needed
    const safeBalance = await baseSepoliaPublicClient.readContract({
      address: TRIGGER_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [safeAddress]
    })

    const safeFundingAmount = 1000000n // 1 USDCP (6 decimals)

    if (safeBalance < safeFundingAmount) {
      console.log("Funding Safe with USDCP on Base Sepolia...")
      const transferHash = await baseSepoliaWalletClient.writeContract({
        address: TRIGGER_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [safeAddress, safeFundingAmount],
        chain: baseSepolia
      })
      await baseSepoliaPublicClient.waitForTransactionReceipt({
        hash: transferHash
      })
      console.log("Safe funded with USDCP on Base Sepolia")
    }

    // Step 4: Fund Nexus orchestrator with USDCP on OP Sepolia
    const nexusBalanceOnOpSepolia = await opSepoliaPublicClient.readContract({
      address: OP_SEPOLIA_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [nexusAddressOnOpSepolia]
    })

    const nexusFundingAmount = 100000n // 0.1 USDCP (6 decimals)

    if (nexusBalanceOnOpSepolia < nexusFundingAmount) {
      console.log("Funding Nexus with USDCP on OP Sepolia...")
      const transferHash = await opSepoliaWalletClient.writeContract({
        address: OP_SEPOLIA_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [nexusAddressOnOpSepolia, nexusFundingAmount],
        chain: optimismSepolia
      })
      await opSepoliaPublicClient.waitForTransactionReceipt({
        hash: transferHash
      })
      console.log("Nexus funded with USDCP on OP Sepolia")
    }
  })

  test.each(modes)(
    "safe account mode STX ($label)",
    async ({ sponsored, simulated }) => {
      const safeQuoteParams = buildGetSafeQuoteParams(
        mcNexus,
        safeAddress,
        recipientAddress,
        { sponsored, simulated }
      )

      // Step 1: Get Safe quote
      const safeQuote = await meeClient.getSafeQuote(safeQuoteParams)

      expect(safeQuote).toBeDefined()
      expect(safeQuote.quote).toBeDefined()
      expect(safeQuote.quote.hash).toBeDefined()
      expect(safeQuote.trigger).toBeDefined()
      expect(safeQuote.quote.quoteType).toBe("safe-sa")

      // Step 2: Prepare Safe transaction data (approve calldata)
      const safeTxnDataPartial = getDataToPrepareSafeTransaction(
        meeClient,
        safeQuote,
        mcNexus
      )

      expect(safeTxnDataPartial).toBeDefined()
      expect(safeTxnDataPartial.to).toBeDefined()
      expect(safeTxnDataPartial.data).toBeDefined()

      // Step 3: Create Safe transaction
      const safeTransaction = await protocolKitOwner1.createTransaction({
        transactions: [safeTxnDataPartial]
      })

      // Step 4: Sign with both owners (2-of-2 multisig)
      let signedSafeTxn =
        await protocolKitOwner1.signTransaction(safeTransaction)
      signedSafeTxn = await protocolKitOwner2.signTransaction(signedSafeTxn)

      expect(signedSafeTxn.signatures.size).toBe(2)

      // Step 5: Sign the Safe quote
      const signedSafeQuote = await meeClient.signSafeQuote({
        fusionQuote: safeQuote,
        signedSafeTxn,
        safeAccount: safeAddress
      })

      expect(signedSafeQuote).toBeDefined()
      expect(signedSafeQuote.signature).toBeDefined()
      expect(signedSafeQuote.signature.startsWith("0x177eee04")).toBe(true) // SAFE_SA_PREFIX

      // Step 6: Execute the signed quote
      const startIndex = safeQuote.quote.paymentInfo.sponsored ? 1 : 0
      const meeVersions = getMeeVersionsForQuote(
        mcNexus,
        signedSafeQuote.userOps.slice(startIndex)
      )

      const { hash } = await executeSignedQuote(meeClient, {
        signedQuote: {
          ...signedSafeQuote,
          meeVersions,
          isEIP712TrustedSponsorshipSupported: true
        }
      })

      expect(hash).toBeDefined()

      // Step 7: Wait for receipt
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }
  )
})
