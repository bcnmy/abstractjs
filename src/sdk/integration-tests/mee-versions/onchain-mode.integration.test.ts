/**
 * On-Chain Mode (Fusion) Integration Tests
 *
 * Tests multi-chain on-chain fusion supertransactions via meeClient across MEE versions.
 * On-chain mode characteristics:
 * - Uses meeClient.getFusionQuote() + meeClient.executeFusionQuote() flow
 * - getFusionQuote auto-detects non-permit token and selects on-chain mode
 * - No smart account pre-funding needed (fusion pulls funds from EOA)
 * - STX instructions transfer the same ERC20 token used in the trigger
 * - Uses testnetMcTestUSDC (no permit) instead of testnetMcTestUSDCP (permit)
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
  erc20Abi
} from "viem"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TEST_BLOCK_CONFIRMATIONS,
  TESTNET_RPC_URLS,
  toNetwork
} from "../../../test/testSetup"
import { testnetMcTestUSDC } from "../../../test/testTokens"
import {
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../clients/createMeeClient"
import type { GetFusionQuoteParams } from "../../clients/decorators/mee/getFusionQuote"
import { MEEVersion } from "../../constants"
import type { AccountConfig } from "./setupMultiVersion"
import { setupMultiVersionAccounts } from "./setupMultiVersion"

const versions = [
  { version: MEEVersion.V2_0_0, label: "V2.0.0" },
  { version: MEEVersion.V2_2_1, label: "V2.2.1" },
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

const TRIGGER_TOKEN_ADDRESS = testnetMcTestUSDC.addressOn(baseSepolia.id)
const TRIGGER_AMOUNT = 1n

function buildGetFusionQuoteParams(
  mcNexus: AccountConfig["mcNexus"],
  eoaAddress: `0x${string}`,
  options: { sponsored: boolean; simulated: boolean }
): GetFusionQuoteParams {
  const trigger = {
    tokenAddress: TRIGGER_TOKEN_ADDRESS,
    amount: TRIGGER_AMOUNT,
    chainId: baseSepolia.id
  }

  // Transfer the same ERC20 token used in the trigger
  const instructions = [
    mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: TRIGGER_TOKEN_ADDRESS,
        amount: TRIGGER_AMOUNT,
        chainId: baseSepolia.id,
        recipient: eoaAddress
      }
    }),
    {
      calls: [{ to: eoaAddress, value: 0n }],
      chainId: optimismSepolia.id
    }
  ]

  const simulation = options.simulated
    ? { simulate: true as const }
    : undefined

  if (options.sponsored) {
    return {
      trigger,
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
    trigger,
    instructions,
    feeToken: {
      address: TRIGGER_TOKEN_ADDRESS,
      chainId: baseSepolia.id
    },
    ...(simulation && { simulation })
  }
}

describe("On-Chain Mode (Fusion) Integration Tests", () => {
  const accountConfigMap = new Map<MEEVersion, AccountConfig>()

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    const configs = await setupMultiVersionAccounts({
      eoaAccount: network.account!,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    for (const config of configs) {
      accountConfigMap.set(config.version, config)
    }
  })

  describe.each(versions)("$label", ({ version }) => {
    const getConfig = () => accountConfigMap.get(version)

    test.each(modes)(
      "onchain fusion STX ($label)",
      async ({ sponsored, simulated }) => {
        const config = getConfig()
        if (!config) return // skip versions not set up
        const { mcNexus, meeClient, eoaAccount } = config

        const fusionQuoteParams = buildGetFusionQuoteParams(
          mcNexus,
          eoaAccount.address,
          { sponsored, simulated }
        )

        const fusionQuote = await meeClient.getFusionQuote(fusionQuoteParams)

        expect(fusionQuote).toBeDefined()
        expect("trigger" in fusionQuote).toBe(true)
        expect(fusionQuote.quote.quoteType).toBe("onchain")

        // Mimic the trigger: manually transfer ERC20 from EOA to smart account
        // (in production, the on-chain trigger contract handles this)
        const deployment = mcNexus.deploymentOn(baseSepolia.id, true)
        const walletClient = createWalletClient({
          account: eoaAccount,
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id])
        })
        const publicClient = deployment.client as PublicClient

        const transferHash = await walletClient.writeContract({
          address: TRIGGER_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "transfer",
          args: [deployment.address, TRIGGER_AMOUNT]
        })
        await publicClient.waitForTransactionReceipt({ hash: transferHash })

        const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
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
