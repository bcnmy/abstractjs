/**
 * Simple Mode (Smart-Account Mode) Integration Tests
 *
 * Tests multi-chain supertransactions via standard meeClient approach across MEE versions.
 * Simple mode characteristics:
 * - Uses meeClient.getQuote() + meeClient.executeQuote() flow
 * - V2.0.0: personal sign
 * - V2.2.1 / V3.0.0: typed data sign
 * - Same code works regardless of account version
 *
 * Test matrix (12 cases total):
 * - 3 versions x 4 combinations of sponsorship (yes/no) and simulation (yes/no)
 *
 * Tested versions: V2.0.0, V2.2.1, V3.0.0
 * Testnets: Base Sepolia, Optimism Sepolia
 */

import {
  http,
  type PublicClient,
  createWalletClient,
  erc20Abi,
  parseUnits
} from "viem"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  toNetwork
} from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import { toP256Signer } from "../../account/utils/toP256Signer"
import {
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../clients/createMeeClient"
import type { GetQuoteParams } from "../../clients/decorators/mee/getQuote"
import { MEEVersion } from "../../constants"
import type { AccountConfig } from "./setupMultiVersion"
import {
  setupAccountsWithSigner,
  setupMultiVersionAccounts
} from "./setupMultiVersion"

const versions = [
  { version: MEEVersion.V2_0_0, label: "V2.0.0" },
  { version: MEEVersion.V2_2_1, label: "V2.2.1" },
  { version: MEEVersion.V2_2_2, label: "V2.2.2" },
  { version: MEEVersion.V3_0_0, label: "V3.0.0" }
]

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

const FEE_TOKEN_ADDRESS = testnetMcTestUSDCP.addressOn(baseSepolia.id)
const MIN_FEE_TOKEN_BALANCE = parseUnits("0.3", 6) // 0.3 USDC
const FUNDING_AMOUNT = parseUnits("1", 6) // 1 USDC

/**
 * Funds smart accounts with feeToken on Base Sepolia if balance < 0.3 USDC.
 * The feeToken is only needed on the payment chain (Base Sepolia).
 */
async function fundFeeTokenIfNeeded(configs: AccountConfig[]) {
  for (const { mcNexus, eoaAccount } of configs) {
    const deployment = mcNexus.deploymentOn(baseSepolia.id, true)
    const publicClient = deployment.client as PublicClient

    const balance = await publicClient.readContract({
      address: FEE_TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [deployment.address]
    })

    if (balance < MIN_FEE_TOKEN_BALANCE) {
      console.log(
        `Funding ${deployment.address} with feeToken on Base Sepolia (balance: ${balance})`
      )
      const walletClient = createWalletClient({
        account: eoaAccount,
        chain: baseSepolia,
        transport: http(TESTNET_RPC_URLS[baseSepolia.id])
      })
      const hash = await walletClient.writeContract({
        address: FEE_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [deployment.address, FUNDING_AMOUNT]
      })
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(
        `Funded ${deployment.address} with 1 USDC on Base Sepolia (tx: ${hash})`
      )
    }
  }
}

const multiChainInstructions = (eoaAddress: `0x${string}`) => [
  {
    calls: [{ to: eoaAddress, value: 0n }],
    chainId: baseSepolia.id
  },
  {
    calls: [{ to: eoaAddress, value: 0n }],
    chainId: optimismSepolia.id
  }
]

function buildGetQuoteParams(
  eoaAddress: `0x${string}`,
  options: { sponsored: boolean; simulated: boolean }
): GetQuoteParams {
  const instructions = multiChainInstructions(eoaAddress)
  const simulation = options.simulated ? { simulate: true as const } : undefined

  if (options.sponsored) {
    return {
      instructions,
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      ...(simulation && { simulation })
    }
  }

  return {
    instructions,
    feeToken: {
      address: testnetMcTestUSDCP.addressOn(baseSepolia.id),
      chainId: baseSepolia.id
    },
    ...(simulation && { simulation })
  }
}

describe("Simple Mode (Smart-Account) Integration Tests", () => {
  const accountConfigMap = new Map<MEEVersion, AccountConfig>()
  let p256AccountConfig: AccountConfig

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    const configs = await setupMultiVersionAccounts({
      eoaAccount: network.account!,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
    await fundFeeTokenIfNeeded(configs)

    for (const config of configs) {
      accountConfigMap.set(config.version, config)
    }

    // Setup P256 account for V3.0.0 only
    const p256PrivateKey =
      "0x1234567890123456789012345678901234567890123456789012345678901234"
    const p256Signer = toP256Signer(p256PrivateKey)
    const p256Configs = await setupAccountsWithSigner({
      signer: p256Signer,
      eoaAccount: network.account!,
      versions: [MEEVersion.V3_0_0],
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
    await fundFeeTokenIfNeeded(p256Configs)
    p256AccountConfig = p256Configs[0]
  })

  describe.each(versions)("$label", ({ version }) => {
    const getConfig = () => accountConfigMap.get(version)

    test.each(modes)(
      "multi-chain simple mode STX ($label)",
      async ({ sponsored, simulated }) => {
        const config = getConfig()
        if (!config) return // skip versions not set up
        const { meeClient, eoaAccount } = config

        const quoteParams = buildGetQuoteParams(eoaAccount.address, {
          sponsored,
          simulated
        })

        const quote = await meeClient.getQuote(quoteParams)

        expect(quote).toBeDefined()
        expect(quote.hash).toBeDefined()

        const { hash } = await meeClient.executeQuote({ quote })
        expect(hash).toBeDefined()

        const receipt = await meeClient.waitForSupertransactionReceipt({
          hash,
          confirmations: TEST_BLOCK_CONFIRMATIONS
        })

        expect(receipt).toBeDefined()
        expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
      }
    )
  })

  // P256 Signer Tests (V3.0.0 only)
  describe("V3.0.0 with P256 Signer", () => {
    test.each(modes)(
      "multi-chain simple mode STX with P256 ($label)",
      async ({ sponsored, simulated }) => {
        const { meeClient, eoaAccount } = p256AccountConfig

        const mockAddress = "0x1234567890123456789012345678901234567890"

        const quoteParams = buildGetQuoteParams(mockAddress, {
          sponsored,
          simulated
        })

        const quote = await meeClient.getQuote(quoteParams)

        expect(quote).toBeDefined()
        expect(quote.hash).toBeDefined()

        const { hash } = await meeClient.executeQuote({ quote })
        expect(hash).toBeDefined()

        const receipt = await meeClient.waitForSupertransactionReceipt({
          hash,
          confirmations: TEST_BLOCK_CONFIRMATIONS
        })

        expect(receipt).toBeDefined()
        expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
      }
    )
  })
})
