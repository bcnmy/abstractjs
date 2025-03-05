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
import { beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../test/testSetup"
import type { NetworkConfig } from "../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account/toMultiChainNexusAccount"
import { type NexusAccount, toNexusAccount } from "../account/toNexusAccount"
import { safeMultiplier } from "../account/utils"
import {
  MAINNET_ADDRESS_K1_VALIDATOR_ADDRESS,
  testnetMcUSDC
} from "../constants"
import { MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS } from "../constants"
import type { NexusClient } from "./createBicoBundlerClient"
import { createBicoBundlerClient } from "./createBicoBundlerClient"
import { type MeeClient, createMeeClient } from "./createMeeClient"
import { erc7579Actions } from "./decorators/erc7579"
import { smartAccountActions } from "./decorators/smartAccount"

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

describe("nexus.interoperability with 'MeeNode'", () => {
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

  test("should send a transaction through the MeeNode", async () => {
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

    const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
    expect(receipt.transactionStatus).toBe("SUCCESS")
  })
})

describe.each(COMPETITORS)(
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
        transport: http(),
        // You can omit this outside of a testing context
        validatorAddress: MAINNET_ADDRESS_K1_VALIDATOR_ADDRESS,
        factoryAddress: MAINNET_ADDRESS_K1_VALIDATOR_FACTORY_ADDRESS
      })

      nexusAccountAddress = await nexusAccount.getCounterFactualAddress()

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
