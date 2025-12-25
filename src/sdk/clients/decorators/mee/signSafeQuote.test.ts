import Safe from "@safe-global/protocol-kit"
import {
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  createPublicClient,
  createWalletClient,
  erc20Abi
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  toNetwork
} from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { MEEVersion } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import {
  getDataToPrepareSafeTransaction,
  getMockSafeSigner
} from "./signSafeQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

describe("getMockSafeSigner", () => {
  const testSafeAddress =
    "0x1234567890123456789012345678901234567890" as Address

  test("should return signer with correct Safe address", () => {
    const signer = getMockSafeSigner(testSafeAddress)
    expect(signer.address).toBe(testSafeAddress)
  })

  test("should throw on signMessage", async () => {
    const signer = getMockSafeSigner(testSafeAddress)
    await expect(signer.signMessage({ message: "test" })).rejects.toThrow(
      "signMessage is not supported for Safe-owned signer"
    )
  })

  test("should throw on signTransaction", async () => {
    const signer = getMockSafeSigner(testSafeAddress)
    await expect(
      signer.signTransaction({
        chainId: 1,
        maxFeePerGas: 1n,
        maxPriorityFeePerGas: 1n,
        gas: 21000n,
        nonce: 0,
        to: testSafeAddress
      })
    ).rejects.toThrow("signTransaction is not supported for Safe-owned signer")
  })

  test("should throw on signTypedData", async () => {
    const signer = getMockSafeSigner(testSafeAddress)
    await expect(
      signer.signTypedData({
        domain: {},
        types: { Message: [{ name: "content", type: "string" }] },
        primaryType: "Message",
        message: { content: "test" }
      })
    ).rejects.toThrow("signTypedData is not supported for Safe-owned signer")
  })
})

describe("mee.signSafeQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let eoaAccountTwo: LocalAccount

  let safeAddress: Address
  let protocolKitOwner1: Safe
  let protocolKitOwner2: Safe

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let recipientAddress: Address

  const triggerChainId = baseSepolia.id
  const baseSepoliaRpcUrl = TESTNET_RPC_URLS[baseSepolia.id]
  const opSepoliaRpcUrl = TESTNET_RPC_URLS[optimismSepolia.id]

  // 0.01 USDCP (6 decimals)
  const transferAmount = 10000n

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    eoaAccount = network.account!
    eoaAccountTwo = network.accountTwo!

    // Generate a random recipient address for the USDCP transfer
    recipientAddress = privateKeyToAccount(generatePrivateKey()).address

    // Get private keys from environment
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
    // First, predict the Safe address using a deterministic configuration
    // To ensure the same address across chains, we must use the same:
    // - safeAccountConfig (owners, threshold)
    // - saltNonce
    // - safeVersion
    const safeAccountConfig = {
      owners: [eoaAccount.address, eoaAccountTwo.address],
      threshold: 2
    }

    // Use explicit saltNonce and safeVersion for consistent multichain deployment
    const safeDeploymentConfig = {
      saltNonce: "0", // Use consistent salt nonce across chains
      safeVersion: "1.4.1" as const // Use explicit version for consistency
    }

    const predictedSafe = {
      safeAccountConfig,
      safeDeploymentConfig
    }

    // Initialize protocol kit with owner 1 to predict the Safe address
    protocolKitOwner1 = await Safe.init({
      provider: baseSepoliaRpcUrl,
      signer: formattedPrivateKey,
      predictedSafe
    })

    const predictedSafeAddress =
      (await protocolKitOwner1.getAddress()) as Address

    // Check if the Safe is already deployed
    const safeCode = await baseSepoliaPublicClient.getCode({
      address: predictedSafeAddress
    })
    const isDeployed = safeCode !== undefined && safeCode !== "0x"

    if (!isDeployed) {
      console.log("Predicted Safe address:", predictedSafeAddress)
      console.log("Deploying new Safe...")

      // Deploy the Safe
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
    } else {
      /*
      console.log(
        "Safe already deployed on Base Sepolia at:",
        predictedSafeAddress
      ) */
    }

    safeAddress = predictedSafeAddress

    // Deploy Safe on OP Sepolia as well (Safe uses deterministic deployment)
    const safeCodeOpSepolia = await opSepoliaPublicClient.getCode({
      address: predictedSafeAddress
    })
    const isDeployedOnOpSepolia =
      safeCodeOpSepolia !== undefined && safeCodeOpSepolia !== "0x"

    if (!isDeployedOnOpSepolia) {
      console.log("Deploying Safe on OP Sepolia...")

      // Initialize protocol kit for OP Sepolia deployment
      // Use the same predictedSafe config to ensure same address
      const protocolKitOpSepolia = await Safe.init({
        provider: opSepoliaRpcUrl,
        signer: formattedPrivateKey,
        predictedSafe
      })

      // Verify predicted address matches
      const predictedAddressOpSepolia = await protocolKitOpSepolia.getAddress()
      console.log(
        "Predicted Safe address on OP Sepolia:",
        predictedAddressOpSepolia
      )
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
    } else {
      /*
      console.log(
        "Safe already deployed on OP Sepolia at:",
        predictedSafeAddress
      )
      */
    }

    // Re-initialize protocol kit with the deployed Safe address
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

    // Step 2: Create Nexus orchestrator on both baseSepolia and opSepolia
    // Use getMockSafeSigner so that the Nexus orchestrator is owned by the Safe
    const safeSigner = getMockSafeSigner(safeAddress)

    mcNexus = await toMultichainNexusAccount({
      signer: safeSigner,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(baseSepoliaRpcUrl),
          version: getMEEVersion(MEEVersion.V2_3_0)
        },
        {
          chain: optimismSepolia,
          transport: http(opSepoliaRpcUrl),
          version: getMEEVersion(MEEVersion.V2_3_0)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const nexusAddressOnBaseSepolia = mcNexus.addressOn(baseSepolia.id, true)
    const nexusAddressOnOpSepolia = mcNexus.addressOn(optimismSepolia.id, true)

    //console.log("Nexus address on Base Sepolia:", nexusAddressOnBaseSepolia)
    //console.log("Nexus address on OP Sepolia:", nexusAddressOnOpSepolia)

    // Step 3: Fund Safe with testnet USDCP token on Base Sepolia
    const usdcpAddressBaseSepolia = testnetMcTestUSDCP.addressOn(baseSepolia.id)
    const safeBalance = await baseSepoliaPublicClient.readContract({
      address: usdcpAddressBaseSepolia,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [safeAddress]
    })

    const safeFundingAmount = 1000000n // 1 USDCP (6 decimals)

    if (safeBalance < safeFundingAmount) {
      console.log("Funding Safe with USDCP on Base Sepolia...")
      const eoaBalance = await baseSepoliaPublicClient.readContract({
        address: usdcpAddressBaseSepolia,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [eoaAccount.address]
      })

      if (eoaBalance < safeFundingAmount) {
        throw new Error(
          `Insufficient USDCP balance in EOA on Base Sepolia. Have: ${eoaBalance}, Need: ${safeFundingAmount}`
        )
      }

      const transferHash = await baseSepoliaWalletClient.writeContract({
        address: usdcpAddressBaseSepolia,
        abi: erc20Abi,
        functionName: "transfer",
        args: [safeAddress, safeFundingAmount],
        chain: baseSepolia
      })

      await baseSepoliaPublicClient.waitForTransactionReceipt({
        hash: transferHash
      })
      console.log("Safe funded with USDCP on Base Sepolia")
    } else {
      /*
      console.log(
        "Safe already has sufficient USDCP balance on Base Sepolia:",
        safeBalance
      )
      */
    }

    // Step 4: Fund Nexus orchestrator with USDCP on OP Sepolia
    // (since there's no trigger on OP Sepolia, we need to fund it manually)
    const usdcpAddressOpSepolia = testnetMcTestUSDCP.addressOn(
      optimismSepolia.id
    )
    const nexusBalanceOnOpSepolia = await opSepoliaPublicClient.readContract({
      address: usdcpAddressOpSepolia,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [nexusAddressOnOpSepolia]
    })

    const nexusFundingAmount = 100000n // 0.1 USDCP (6 decimals) - enough for a few transfers

    if (nexusBalanceOnOpSepolia < nexusFundingAmount) {
      console.log("Funding Nexus orchestrator with USDCP on OP Sepolia...")
      const eoaBalanceOpSepolia = await opSepoliaPublicClient.readContract({
        address: usdcpAddressOpSepolia,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [eoaAccount.address]
      })

      if (eoaBalanceOpSepolia < nexusFundingAmount) {
        throw new Error(
          `Insufficient USDCP balance in EOA on OP Sepolia. Have: ${eoaBalanceOpSepolia}, Need: ${nexusFundingAmount}`
        )
      }

      const transferHash = await opSepoliaWalletClient.writeContract({
        address: usdcpAddressOpSepolia,
        abi: erc20Abi,
        functionName: "transfer",
        args: [nexusAddressOnOpSepolia, nexusFundingAmount],
        chain: optimismSepolia
      })

      await opSepoliaPublicClient.waitForTransactionReceipt({
        hash: transferHash
      })
      console.log("Nexus orchestrator funded with USDCP on OP Sepolia")
    } else {
      /*
      console.log(
        "Nexus orchestrator already has sufficient USDCP balance on OP Sepolia:",
        nexusBalanceOnOpSepolia
      )
      */
    }
  })

  test("should sign a Safe quote with multiple signers", async () => {
    const usdcpAddressBaseSepolia = testnetMcTestUSDCP.addressOn(baseSepolia.id)
    const usdcpAddressOpSepolia = testnetMcTestUSDCP.addressOn(
      optimismSepolia.id
    )
    const triggerAmount = 123000n // 0.123 USDCP (6 decimals)

    // Step 1: Get the Safe quote
    // Payment and trigger on Base Sepolia
    // Instructions on both Base Sepolia and OP Sepolia
    const safeQuote = await meeClient.getSafeQuote({
      trigger: {
        tokenAddress: usdcpAddressBaseSepolia,
        chainId: triggerChainId,
        amount: triggerAmount
      },
      instructions: [
        // Transfer 0.01 USDCP on Base Sepolia
        mcNexus.build({
          type: "transferFrom", // we use transferFrom because Safe only approves funds in the trigger
          data: {
            tokenAddress: usdcpAddressBaseSepolia,
            amount: transferAmount,
            chainId: baseSepolia.id,
            recipient: recipientAddress,
            sender: mcNexus.signer.address
          }
        }),
        // Transfer 0.01 USDCP on OP Sepolia
        mcNexus.build({
          // here we use transfer as on the target chain we assume
          // funds land on the orchestrator address itself
          type: "transfer",
          data: {
            tokenAddress: usdcpAddressOpSepolia,
            amount: transferAmount,
            chainId: optimismSepolia.id,
            recipient: recipientAddress
          }
        })
      ],
      feeToken: {
        address: usdcpAddressBaseSepolia,
        chainId: triggerChainId
      },
      safeAccount: safeAddress
    })

    expect(safeQuote).toBeDefined()
    expect(safeQuote.quote).toBeDefined()
    expect(safeQuote.quote.hash).toBeDefined()
    expect(safeQuote.trigger).toBeDefined()

    // Step 2: Get data to prepare Safe transaction
    const safeTxnDataPartial = getDataToPrepareSafeTransaction(
      meeClient,
      safeQuote,
      mcNexus
    )

    expect(safeTxnDataPartial).toBeDefined()
    expect(safeTxnDataPartial.to).toBeDefined()
    expect(safeTxnDataPartial.data).toBeDefined()

    /*
    console.log("Safe transaction data prepared:", {
      to: safeTxnDataPartial.to,
      data: safeTxnDataPartial.data
    })
    */

    // Step 3: Create Safe transaction using protocol-kit
    const safeTransaction = await protocolKitOwner1.createTransaction({
      transactions: [safeTxnDataPartial]
    })
    expect(safeTransaction).toBeDefined()

    // Step 4: Sign with first owner
    let signedSafeTxn = await protocolKitOwner1.signTransaction(safeTransaction)
    // Step 5: Sign with second owner
    signedSafeTxn = await protocolKitOwner2.signTransaction(signedSafeTxn)

    // Verify we have the required signatures
    const signatures = signedSafeTxn.signatures
    expect(signatures.size).toBe(2)

    // Step 6: Sign the Safe quote using signSafeQuote
    const signedSafeQuote = await meeClient.signSafeQuote({
      fusionQuote: safeQuote,
      signedSafeTxn,
      safeAccount: safeAddress
    })

    expect(signedSafeQuote).toBeDefined()
    expect(signedSafeQuote.signature).toBeDefined()
    expect(signedSafeQuote.signature.startsWith("0x177eee04")).toBe(true) // SAFE_SA_PREFIX

    console.log("Quote hash:", signedSafeQuote.hash)

    // Step 7: Execute the signed quote
    const { hash } = await executeSignedQuote(meeClient, {
      signedQuote: signedSafeQuote
    })

    // Step 8: Wait for the supertransaction receipt
    const receipt = await waitForSupertransactionReceipt(meeClient, {
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    expect(receipt.explorerLinks.length).toBeGreaterThan(0)
  })
})
