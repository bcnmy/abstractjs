import {
  http,
  type Address,
  type Chain,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  parseUnits
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { paymasterTruthy, toNetwork } from "../../test/testSetup"
import { getBalance, killNetwork } from "../../test/testUtils"
import type { NetworkConfig } from "../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../account/toNexusAccount"
import { BICONOMY_TOKEN_PAYMASTER } from "../account/utils/Constants"
import {
  type NexusClient,
  createSmartAccountClient
} from "./createBicoBundlerClient"
import {
  type BicoPaymasterClient,
  createBicoPaymasterClient,
  toBiconomyTokenPaymasterContext
} from "./createBicoPaymasterClient"

// NB These tests require ERC20 tokens to be available on testnet, so they are mostly skipped
describe.skipIf(!paymasterTruthy())("bico.paymaster", async () => {
  let network: NetworkConfig

  let chain: Chain
  let bundlerUrl: string
  let paymasterUrl: undefined | string
  let walletClient: WalletClient

  // Test utils
  let publicClient: PublicClient // testClient not available on public testnets
  let account: PrivateKeyAccount
  let recipientAddress: Address
  let nexusAccountAddress: Address
  let paymaster: BicoPaymasterClient
  let nexusAccount: NexusAccount
  let nexusClient: NexusClient

  const baseSepoliaUSDCAddress: Address =
    "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
  const baseSepoliaDAIAddress: Address =
    "0x7683022d84f726a96c4a6611cd31dbf5409c0ac9"

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    paymasterUrl = network.paymasterUrl
    account = network.account as PrivateKeyAccount

    recipientAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" // vitalik.eth

    walletClient = createWalletClient({
      account,
      chain,
      transport: http()
    })

    publicClient = createPublicClient({
      chain,
      transport: http()
    })

    paymaster = createBicoPaymasterClient({
      transport: http(paymasterUrl)
    })

    nexusAccount = await toNexusAccount({
      signer: account,
      chain,
      transport: http()
    })

    nexusAccountAddress = await nexusAccount.getCounterFactualAddress()

    nexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl),
      paymaster
    })
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should have paymaster actions", async () => {
    expect(paymaster).toHaveProperty("getPaymasterData")
    expect(paymaster.getPaymasterData).toBeInstanceOf(Function)

    // Bico Paymaster has no getPaymasterStubData method, to ensure latency is kept low.
    expect(paymaster).not.toHaveProperty("getPaymasterStubData")
  })

  test("should send a sponsored transaction", async () => {
    // Get initial balance
    const initialBalance = await publicClient.getBalance({
      address: nexusAccountAddress
    })

    // Send user operation
    const hash = await nexusClient.sendTransaction({
      calls: [
        {
          to: recipientAddress,
          value: 1n
        }
      ]
    })

    // Wait for the transaction to be mined
    const { status } = await publicClient.waitForTransactionReceipt({ hash })
    expect(status).toBe("success")
    // Get final balance
    const finalBalance = await publicClient.getBalance({
      address: nexusAccountAddress
    })

    // Check that the balance hasn't changed
    // No gas fees were paid, so the balance should have decreased only by 1n
    expect(finalBalance).toBe(initialBalance - 1n)
  })

  test("should wait for a confirmed user operation receipt", async () => {
    const hash = await nexusClient.sendUserOperation({
      calls: [
        {
          to: recipientAddress,
          value: 1n
        }
      ]
    })

    const receipt = await nexusClient.waitForConfirmedUserOperationReceipt({
      hash
    })

    expect(receipt.success).toBe("true")
  })

  test.skip("should use token paymaster to pay for gas fees, use max approval, use sendUserOperation", async () => {
    const balanceOfFeeToken = await getBalance(
      publicClient,
      nexusAccountAddress,
      baseSepoliaUSDCAddress
    )
    const paymasterContext = toBiconomyTokenPaymasterContext({
      feeTokenAddress: baseSepoliaUSDCAddress
    })
    const nexusClient = createSmartAccountClient({
      account: nexusAccount,
      paymaster: createBicoPaymasterClient({
        transport: http(paymasterUrl)
      }),
      paymasterContext,
      transport: http(bundlerUrl)
    })

    const initialBalance = await publicClient.getBalance({
      address: nexusAccountAddress
    })

    const hash = await nexusClient.sendTokenPaymasterUserOp({
      calls: [
        {
          to: recipientAddress,
          value: 1n,
          data: "0x"
        }
      ],
      feeTokenAddress: baseSepoliaUSDCAddress
    })
    const receipt = await nexusClient.waitForUserOperationReceipt({ hash })

    expect(receipt.success).toBe("true")

    // Get final balance
    const finalBalance = await publicClient.getBalance({
      address: nexusAccountAddress
    })

    // Check that the balance hasn't changed
    // No gas fees were paid, so the balance should have decreased only by 1n
    expect(finalBalance).toBe(initialBalance - 1n)
  })

  test.skip("should use token paymaster to pay for gas fees, use max approval, use sendTransaction", async () => {
    const paymasterContext = toBiconomyTokenPaymasterContext({
      feeTokenAddress: baseSepoliaUSDCAddress
    })

    const nexusClient = createSmartAccountClient({
      account: nexusAccount,
      paymaster: createBicoPaymasterClient({
        transport: http(paymasterUrl)
      }),
      paymasterContext,
      transport: http(bundlerUrl)
    })

    const initialBalance = await publicClient.getBalance({
      address: nexusAccountAddress
    })

    const tokenPaymasterUserOp = await nexusClient.prepareTokenPaymasterUserOp({
      calls: [
        {
          to: recipientAddress,
          value: 1n,
          data: "0x"
        }
      ],
      feeTokenAddress: baseSepoliaUSDCAddress
    })

    const hash = await nexusClient.sendTransaction(tokenPaymasterUserOp)

    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    expect(receipt.status).toBe("success")

    // Get final balance
    const finalBalance = await publicClient.getBalance({
      address: nexusAccountAddress
    })

    // Check that the balance hasn't changed
    // No gas fees were paid, so the balance should have decreased only by 1n
    expect(finalBalance).toBe(initialBalance - 1n)
  })

  test("should retrieve quotes from token paymaster", async () => {
    const tokenList = [baseSepoliaUSDCAddress]
    const userOp = await nexusClient.prepareUserOperation({
      calls: [
        {
          to: recipientAddress,
          value: 1n,
          data: "0x"
        }
      ]
    })
    const quote = await paymaster.getTokenPaymasterQuotes({ userOp, tokenList })
    expect(quote.mode).toBe("ERC20")
    expect(quote.paymasterAddress).toBe(BICONOMY_TOKEN_PAYMASTER)
    expect(quote.feeQuotes).toBeInstanceOf(Array)
    expect(quote.unsupportedTokens).toBeInstanceOf(Array)

    expect(quote.feeQuotes[0].symbol).toBe("USDC")
    expect(quote.feeQuotes[0].decimal).toBe(6)
    expect(quote.feeQuotes[0].tokenAddress).toBe(baseSepoliaUSDCAddress)
    expect(quote.feeQuotes[0].maxGasFee).toBeGreaterThan(0)
    expect(quote.feeQuotes[0].maxGasFeeUSD).toBeGreaterThan(0)
    expect(quote.feeQuotes[0].exchangeRate).toBeGreaterThan(0)
  })

  test.skip("should use token paymaster to pay for gas fees, use custom approval with token paymaster quotes", async () => {
    const paymasterContext = toBiconomyTokenPaymasterContext({
      feeTokenAddress: baseSepoliaUSDCAddress
    })

    const nexusClient = createSmartAccountClient({
      account: nexusAccount,
      paymaster: createBicoPaymasterClient({
        transport: http(paymasterUrl)
      }),
      paymasterContext,
      transport: http(bundlerUrl)
    })

    const usdcBalance = await getBalance(
      publicClient,
      nexusClient.account.address,
      baseSepoliaUSDCAddress
    )

    expect(usdcBalance).toBeGreaterThan(0n)

    const initialBalance = await publicClient.getBalance({
      address: nexusClient.account.address
    })

    const tokenList = [baseSepoliaUSDCAddress]
    const userOp = await nexusClient.prepareUserOperation({
      calls: [
        {
          to: recipientAddress,
          value: 1n,
          data: "0x"
        }
      ]
    })
    const quote = await paymaster.getTokenPaymasterQuotes({ userOp, tokenList })
    const usdcFeeAmount = parseUnits(
      quote.feeQuotes[0].maxGasFee.toString(),
      quote.feeQuotes[0].decimal
    )

    const hash = await nexusClient.sendTokenPaymasterUserOp({
      calls: [
        {
          to: recipientAddress,
          value: 1n,
          data: "0x"
        }
      ],
      feeTokenAddress: baseSepoliaUSDCAddress,
      customApprovalAmount: usdcFeeAmount
    })

    const receipt = await nexusClient.waitForUserOperationReceipt({ hash })

    expect(receipt.success).toBe("true")

    const finalBalance = await publicClient.getBalance({
      address: nexusClient.account.address
    })

    expect(finalBalance).toBe(initialBalance - 1n)
  })

  test("should retrieve all supported token addresses from the token paymaster", async () => {
    const paymasterContext = toBiconomyTokenPaymasterContext({
      feeTokenAddress: baseSepoliaUSDCAddress
    })

    const nexusClient = createSmartAccountClient({
      account: nexusAccount,
      paymaster: createBicoPaymasterClient({
        transport: http(paymasterUrl)
      }),
      paymasterContext,
      transport: http(bundlerUrl)
    })

    const supportedTokens = await paymaster.getSupportedTokens(nexusClient)
    const supportedTokenAddresses = supportedTokens.map(
      (token) => token.tokenAddress
    )
    expect(supportedTokenAddresses).toContain(baseSepoliaUSDCAddress)
    expect(supportedTokenAddresses).toContain(baseSepoliaDAIAddress)
  })
})
