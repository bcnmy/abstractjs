import {
  http,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  createPublicClient
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { toNetwork } from "../../test/testSetup"
import type { NetworkConfig } from "../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account/toMultiChainNexusAccount"
import { type NexusAccount, toNexusAccount } from "../account/toNexusAccount"
import { safeMultiplier } from "../account/utils"
import { testnetMcUSDC } from "../constants"
import type { NexusClient } from "./createBicoBundlerClient"
import { createBicoBundlerClient } from "./createBicoBundlerClient"
import { type MeeClient, createMeeClient } from "./createMeeClient"
import { erc7579Actions } from "./decorators/erc7579"
import { smartAccountActions } from "./decorators/smartAccount"

// @ts-ignore
const { runPaidTests } = inject("settings")

const COMPETITORS = [
  {
    name: "Alto",
    chain: baseSepolia,
    bundlerUrl: `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${process.env.PIMLICO_API_KEY}`,
    mock: true
  },
  {
    name: "Biconomy",
    bundlerUrl: `https://bundler.biconomy.io/api/v3/${baseSepolia.id}/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44`,
    chain: baseSepolia,
    mock: false
  }
]

const calls = [
  {
    to: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as Address, // vitalik.eth
    value: 1n
  }
]

describe.runIf(runPaidTests)("nexus.interoperability with 'MeeNode'", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let chain: Chain

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = baseSepolia

    mcNexus = await toMultichainNexusAccount({
      chains: [baseSepolia],
      transports: [http()],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  /**
   * This test doesn't utilise Fusion =>  there is not trigger Txn,
   * and Nexus is NOT prefunded before userOp =>
   * => Nexus account SHOULD have its own USDC balance
   * Otherwise the test will fail
   */
  test("should send a transaction through the MeeNode", async () => {
    const usdcBalance = await createPublicClient({
      chain: baseSepolia,
      transport: http()
    }).getBalance({
      address: mcNexus.addressOn(baseSepolia.id, true)
    })

    if (usdcBalance === 0n) {
      throw new Error("Insufficient balance")
    }

    const { hash } = await meeClient.execute({
      instructions: [
        {
          calls,
          chainId: baseSepolia.id
        }
      ],
      feeToken: {
        address: testnetMcUSDC.addressOn(baseSepolia.id),
        chainId: baseSepolia.id
      }
    })

    const { transactionStatus } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
  })
})

describe.runIf(runPaidTests).each(COMPETITORS)(
  "nexus.interoperability with $name bundler",
  async ({ bundlerUrl, chain, mock }) => {
    const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY as Hex}`)
    const publicClient = createPublicClient({ chain, transport: http() })
    let nexusAccountAddress: Address
    let nexusAccount: NexusAccount
    let bundlerClient: NexusClient

    beforeAll(async () => {
      nexusAccount = await toNexusAccount({
        signer: account,
        chain,
        transport: http()
      })

      nexusAccountAddress = await nexusAccount.getAddress()

      const balance = await publicClient.getBalance({
        address: nexusAccountAddress
      })

      if (balance === 0n) {
        throw new Error(
          `Insufficient balance at address: ${nexusAccountAddress}`
        )
      }

      bundlerClient = createBicoBundlerClient({
        mock,
        chain,
        transport: http(bundlerUrl),
        account: nexusAccount,
        // Different vendors have different fee estimation strategies
        userOperation: {
          estimateFeesPerGas: async (_) => {
            const feeData = await publicClient.estimateFeesPerGas()
            return {
              maxFeePerGas: safeMultiplier(feeData.maxFeePerGas, 1.6),
              maxPriorityFeePerGas: safeMultiplier(
                feeData.maxPriorityFeePerGas,
                1.6
              )
            }
          }
        }
      })
        .extend(erc7579Actions())
        .extend(smartAccountActions()) as unknown as NexusClient
    })

    test("should send a transaction through bundler", async () => {
      // Get initial balance
      const initialBalance = await publicClient.getBalance({
        address: nexusAccountAddress
      })

      // Send user operation
      const userOp = await bundlerClient.prepareUserOperation({ calls })
      const userOpHash = await bundlerClient.sendUserOperation(userOp)
      const userOpReceipt = await bundlerClient.waitForUserOperationReceipt({
        hash: userOpHash
      })

      // Wait for the transaction to be mined
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: userOpReceipt.receipt.transactionHash
      })
      expect(receipt.status).toBe("success")

      // Get final balance
      const finalBalance = await publicClient.getBalance({
        address: nexusAccountAddress
      })

      // Check that the balance has decreased
      expect(finalBalance).toBeLessThan(initialBalance)
    })
  }
)
