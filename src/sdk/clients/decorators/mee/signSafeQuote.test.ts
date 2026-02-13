import Safe from "@safe-global/protocol-kit"
import { OperationType } from "@safe-global/types-kit"
import {
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type Transport,
  createPublicClient,
  createWalletClient,
  decodeFunctionData,
  encodePacked,
  erc20Abi,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { TESTNET_RPC_URLS, toNetwork } from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { MEEVersion } from "../../../constants"
import { ForwarderAbi } from "../../../constants/abi/ForwarderAbi"
import { getMEEVersion } from "../../../modules"
import type { BaseMeeClient } from "../../createMeeClient"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type { GetQuotePayload } from "./getQuote"
import type { GetSafeQuotePayload } from "./getSafeQuote"
import {
  getDataToPrepareSafeTransaction,
  getMockSafeSigner,
  validateSafeDeployment
} from "./signSafeQuote"

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

describe("getDataToPrepareSafeTransaction", () => {
  const mockQuoteHash =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex
  const mockTokenAddress =
    "0x1111111111111111111111111111111111111111" as Address
  const mockNexusAddress =
    "0x2222222222222222222222222222222222222222" as Address
  const mockEthForwarderAddress =
    "0x3333333333333333333333333333333333333333" as Address
  const mockRecipientAddress =
    "0x4444444444444444444444444444444444444444" as Address

  const createMockAccount = (
    nexusAddress: Address,
    ethForwarderAddress: Address
  ): MultichainSmartAccount =>
    ({
      addressOn: (_chainId: number, _strictMode?: boolean) => nexusAddress,
      deploymentOn: (_chainId: number, _strictMode?: boolean) => ({
        version: { ethForwarderAddress }
      })
    }) as unknown as MultichainSmartAccount

  const createMockClient = (account: MultichainSmartAccount): BaseMeeClient =>
    ({ account }) as unknown as BaseMeeClient

  const createMockQuoteParams = (
    overrides: Partial<GetSafeQuotePayload["trigger"]> = {}
  ): GetSafeQuotePayload => ({
    quote: { hash: mockQuoteHash } as GetSafeQuotePayload["quote"],
    trigger: {
      tokenAddress: mockTokenAddress,
      chainId: baseSepolia.id,
      amount: 1000000n,
      ...overrides
    } as GetSafeQuotePayload["trigger"]
  })

  test("should generate ERC20 approve calldata for token triggers", () => {
    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const quoteParams = createMockQuoteParams()

    const result = getDataToPrepareSafeTransaction(mockClient, quoteParams)

    expect(result.to).toBe(mockTokenAddress)
    expect(result.value).toBe("0")
    expect(result.operation).toBe(OperationType.Call)

    // Verify the calldata contains the approve function call
    const dataWithoutHash = result.data.slice(0, result.data.length - 64) as Hex
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: dataWithoutHash
    })
    expect(decoded.functionName).toBe("approve")
    expect(decoded.args[0]).toBe(mockNexusAddress) // spender
    expect(decoded.args[1]).toBe(1000000n) // amount

    // Verify quote hash is appended
    expect(result.data.endsWith(mockQuoteHash.slice(2))).toBe(true)
  })

  test("should use approvalAmount when provided", () => {
    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const quoteParams = createMockQuoteParams({
      amount: 1000000n,
      approvalAmount: 2000000n
    })

    const result = getDataToPrepareSafeTransaction(mockClient, quoteParams)

    const dataWithoutHash = result.data.slice(0, result.data.length - 64) as Hex
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: dataWithoutHash
    })
    expect(decoded.args[1]).toBe(2000000n) // should use approvalAmount
  })

  test("should generate ETH forwarder calldata for native token triggers", () => {
    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const quoteParams = createMockQuoteParams({
      tokenAddress: zeroAddress,
      amount: 1000000000000000000n // 1 ETH
    })

    const result = getDataToPrepareSafeTransaction(mockClient, quoteParams)

    expect(result.to).toBe(mockEthForwarderAddress)
    expect(result.value).toBe("1000000000000000000")
    expect(result.operation).toBe(OperationType.Call)

    // Verify the calldata contains the forward function call
    const dataWithoutHash = result.data.slice(0, result.data.length - 64) as Hex
    const decoded = decodeFunctionData({
      abi: ForwarderAbi,
      data: dataWithoutHash
    })
    expect(decoded.functionName).toBe("forward")
    expect(decoded.args[0]).toBe(mockNexusAddress) // recipient defaults to spender
  })

  test("should use recipientAddress when provided for native token", () => {
    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const quoteParams = createMockQuoteParams({
      tokenAddress: zeroAddress,
      amount: 1000000000000000000n,
      recipientAddress: mockRecipientAddress
    })

    const result = getDataToPrepareSafeTransaction(mockClient, quoteParams)

    const dataWithoutHash = result.data.slice(0, result.data.length - 64) as Hex
    const decoded = decodeFunctionData({
      abi: ForwarderAbi,
      data: dataWithoutHash
    })
    expect(decoded.args[0]).toBe(mockRecipientAddress)
  })

  test("should throw error for custom triggers", () => {
    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const quoteParams = {
      quote: { hash: mockQuoteHash } as GetSafeQuotePayload["quote"],
      trigger: {
        chainId: baseSepolia.id,
        call: {
          to: mockTokenAddress,
          data: "0x1234" as Hex,
          value: 0n,
          gasLimit: 100000n
        }
      }
    } as GetSafeQuotePayload

    expect(() =>
      getDataToPrepareSafeTransaction(mockClient, quoteParams)
    ).toThrow("Custom triggers are not supported for Safe fusion transactions")
  })

  test("should throw error when amount is missing", () => {
    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const quoteParams = {
      quote: { hash: mockQuoteHash } as GetSafeQuotePayload["quote"],
      trigger: {
        tokenAddress: mockTokenAddress,
        chainId: baseSepolia.id
      }
    } as GetSafeQuotePayload

    expect(() =>
      getDataToPrepareSafeTransaction(mockClient, quoteParams)
    ).toThrow("Amount is required to sign a Safe quote")
  })

  test("should use companionAccount when provided", () => {
    const companionNexusAddress =
      "0x5555555555555555555555555555555555555555" as Address
    const companionEthForwarder =
      "0x6666666666666666666666666666666666666666" as Address

    const mockAccount = createMockAccount(
      mockNexusAddress,
      mockEthForwarderAddress
    )
    const mockClient = createMockClient(mockAccount)
    const companionAccount = createMockAccount(
      companionNexusAddress,
      companionEthForwarder
    )
    const quoteParams = createMockQuoteParams()

    const result = getDataToPrepareSafeTransaction(
      mockClient,
      quoteParams,
      companionAccount
    )

    // Verify it uses the companion account's address as spender
    const dataWithoutHash = result.data.slice(0, result.data.length - 64) as Hex
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: dataWithoutHash
    })
    expect(decoded.args[0]).toBe(companionNexusAddress)
  })
})

describe("validateSafeDeployment", () => {
  const mockSafeAddress = zeroAddress // should have no code on all chains

  const createMockQuote = (
    userOps: Array<{ chainId: string }>,
    sponsored = false
  ): GetQuotePayload =>
    ({
      hash: "0xabc" as Hex,
      userOps: userOps.map((op) => ({ chainId: op.chainId })),
      paymentInfo: { sponsored }
    }) as unknown as GetQuotePayload

  const createMockClientWithDeployments = (
    chainConfigs: Array<{ chainId: number; chain: Chain }>
  ): BaseMeeClient => {
    const account = {
      deploymentOn: (chainId: number, _strictMode?: boolean) => {
        const config = chainConfigs.find((c) => c.chainId === chainId)
        if (!config) return undefined
        return {
          client: {
            chain: config.chain
          }
        }
      }
    } as unknown as MultichainSmartAccount
    return { account } as unknown as BaseMeeClient
  }

  test("should pass when Safe is deployed on all involved chains", async () => {
    // Use a real deployed contract address (entry point is deployed everywhere)
    const addressWithCode =
      "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as Address

    const mockClient = createMockClientWithDeployments([
      { chainId: baseSepolia.id, chain: baseSepolia }
    ])

    const quote = createMockQuote([{ chainId: baseSepolia.id.toString() }])

    // Should not throw
    await expect(
      validateSafeDeployment(mockClient, quote, addressWithCode)
    ).resolves.toBeUndefined()
  })

  test("should throw when Safe is not deployed on a required chain", async () => {
    const mockClient = createMockClientWithDeployments([
      { chainId: baseSepolia.id, chain: baseSepolia }
    ])

    const quote = createMockQuote([{ chainId: baseSepolia.id.toString() }])

    // Use an address with no code
    await expect(
      validateSafeDeployment(mockClient, quote, mockSafeAddress)
    ).rejects.toThrow(
      `Safe at ${mockSafeAddress} is not deployed on chains: ${baseSepolia.id}`
    )
  })

  test("should check multiple chains and report all undeployed ones", async () => {
    const mockClient = createMockClientWithDeployments([
      { chainId: baseSepolia.id, chain: baseSepolia },
      { chainId: optimismSepolia.id, chain: optimismSepolia }
    ])

    const quote = createMockQuote([
      { chainId: baseSepolia.id.toString() },
      { chainId: optimismSepolia.id.toString() }
    ])

    try {
      await validateSafeDeployment(mockClient, quote, mockSafeAddress)
      expect.fail("Expected validateSafeDeployment to throw")
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain("is not deployed on chains:")
      expect(message).toContain(baseSepolia.id.toString())
      expect(message).toContain(optimismSepolia.id.toString())
    }
  })

  test("should skip payment userOp chain when sponsored", async () => {
    // This address has code on optimismSepolia but NOT on baseSepolia
    const addressWithCodeOnlyOnOpSepolia =
      "0x6db5b92627d073e602ef08ee1699de2e4b5e557d" as Address

    // Configure both chains
    const mockClient = createMockClientWithDeployments([
      { chainId: baseSepolia.id, chain: baseSepolia },
      { chainId: optimismSepolia.id, chain: optimismSepolia }
    ])

    // When sponsored, the first userOp (payment) should be skipped
    const quote = createMockQuote(
      [
        { chainId: baseSepolia.id.toString() }, // emulates Payment userOp
        { chainId: optimismSepolia.id.toString() }
      ],
      true // sponsored = true, default payment chain with sponsorship is op sepolia
    )

    // Should not throw because baseSepolia (payment chain) is skipped when sponsored
    // and the checked address has code on op sepolia
    await expect(
      validateSafeDeployment(mockClient, quote, addressWithCodeOnlyOnOpSepolia)
    ).resolves.toBeUndefined()
  })

  test("should include payment userOp chain when not sponsored", async () => {
    const addressWithCodeOnlyOnOpSepolia =
      "0x6db5b92627d073e602ef08ee1699de2e4b5e557d" as Address

    const mockClient = createMockClientWithDeployments([
      { chainId: baseSepolia.id, chain: baseSepolia },
      { chainId: optimismSepolia.id, chain: optimismSepolia }
    ])

    const quote = createMockQuote(
      [
        { chainId: baseSepolia.id.toString() }, // emulates payment userOp
        { chainId: optimismSepolia.id.toString() } // Actual instruction
      ],
      false // sponsored = false
    )

    // Should throw because checked address has no code on op base sepolia chain
    await expect(
      validateSafeDeployment(mockClient, quote, addressWithCodeOnlyOnOpSepolia)
    ).rejects.toThrow(
      `Safe at ${addressWithCodeOnlyOnOpSepolia} is not deployed on chains: ${baseSepolia.id}`
    )
  })
})

describe("mee.signSafeQuote", () => {
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
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")

    const eoaAccount = network.account!
    const eoaAccountTwo = network.accountTwo!

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
          version: getMEEVersion(MEEVersion.V3_0_0)
        },
        {
          chain: optimismSepolia,
          transport: http(opSepoliaRpcUrl),
          version: getMEEVersion(MEEVersion.V3_0_0)
        }
      ],
      defaultModuleParameters: {
        statelessValidator: getMEEVersion(MEEVersion.V3_0_0).submodules
          ?.SafeAccountSubmodule as Address,
        ownershipData: encodePacked(["address"], [safeAddress])
      }
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
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
          type: "transfer",
          data: {
            tokenAddress: usdcpAddressBaseSepolia,
            amount: transferAmount,
            chainId: baseSepolia.id,
            recipient: recipientAddress
            //sender: mcNexus.signer.address
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

    //console.log("Safe quote:", safeQuote)

    // Step 2: Get data to prepare Safe transaction
    const safeTxnDataPartial = getDataToPrepareSafeTransaction(
      meeClient,
      safeQuote,
      mcNexus
    )

    expect(safeTxnDataPartial).toBeDefined()
    expect(safeTxnDataPartial.to).toBeDefined()
    expect(safeTxnDataPartial.data).toBeDefined()

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
  })
})
