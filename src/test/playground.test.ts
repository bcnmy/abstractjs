import {
  http,
  type Address,
  type Chain,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  parseEther
} from "viem"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { toNexusAccount } from "../sdk/account/toNexusAccount"
import { playgroundTrue } from "../sdk/account/utils/Utils"
import {
  type NexusClient,
  createSmartAccountClient
} from "../sdk/clients/createBicoBundlerClient"
import {
  type BicoPaymasterClient,
  type BiconomyPaymasterContext,
  biconomySponsoredPaymasterContext,
  createBicoPaymasterClient
} from "../sdk/clients/createBicoPaymasterClient"
import { DEFAULT_MEE_VERSION } from "../sdk/constants"
import { getMEEVersion } from "../sdk/modules"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "./testSetup"
import type { NetworkConfig } from "./testUtils"

const index = 0n

// @ts-ignore
const { runLifecycleTests } = inject("settings")

describe.skipIf(!playgroundTrue() || !runLifecycleTests)("playground", () => {
  let network: NetworkConfig
  // Nexus Config
  let chain: Chain
  let bundlerUrl: string
  let walletClient: WalletClient
  let paymasterUrl: string | undefined
  let nexusAccountAddress: Address

  // Test utils
  let publicClient: PublicClient // testClient not available on public testnets
  let eoaAccount: PrivateKeyAccount
  let recipientAddress: Address
  let nexusClient: NexusClient

  let paymasterParams:
    | undefined
    | {
        paymaster: BicoPaymasterClient
        paymasterContext: BiconomyPaymasterContext
      }

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    paymasterUrl = network.paymasterUrl
    eoaAccount = network.account as PrivateKeyAccount

    recipientAddress = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    publicClient = createPublicClient({
      chain,
      transport: http(network.rpcUrl)
    })

    paymasterParams = paymasterUrl
      ? {
          paymaster: createBicoPaymasterClient({
            transport: http(paymasterUrl)
          }),
          paymasterContext: biconomySponsoredPaymasterContext
        }
      : undefined
  })

  test("should init the smart account", async () => {
    nexusClient = createSmartAccountClient({
      account: await toNexusAccount({
        signer: eoaAccount,
        chainConfiguration: {
          chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        index
      }),
      transport: http(bundlerUrl),
      ...(paymasterParams ? paymasterParams : {})
    })
  })

  test("should log relevant addresses", async () => {
    nexusAccountAddress = await nexusClient.account.getAddress()
    console.log({ nexusAccountAddress })
  })

  test("should check balances and top up relevant addresses", async () => {
    const [ownerBalance, smartAccountBalance] = await Promise.all([
      publicClient.getBalance({
        address: eoaAccount.address
      }),
      publicClient.getBalance({
        address: nexusAccountAddress
      })
    ])

    const balancesAreOfCorrectType = [ownerBalance, smartAccountBalance].every(
      (balance) => typeof balance === "bigint"
    )
    if (smartAccountBalance === 0n) {
      const hash = await walletClient.sendTransaction({
        chain,
        account: eoaAccount,
        to: nexusAccountAddress,
        value: parseEther("0.01")
      })
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
      expect(receipt.status).toBe("success")
      const [ownerBalanceTwo, smartAccountBalanceTwo] = await Promise.all([
        publicClient.getBalance({ address: eoaAccount.address }),
        publicClient.getBalance({ address: nexusAccountAddress })
      ])
      console.log({ ownerBalanceTwo, smartAccountBalanceTwo })
    }
    expect(balancesAreOfCorrectType).toBeTruthy()
  })

  test("should send some native token", async () => {
    const balanceBefore = await publicClient.getBalance({
      address: recipientAddress
    })
    const hash = await nexusClient.sendUserOperation({
      calls: [{ to: recipientAddress, value: 1n }]
    })
    const { success } = await nexusClient.waitForUserOperationReceipt({ hash })
    const balanceAfter = await publicClient.getBalance({
      address: recipientAddress
    })
    expect(success).toBe("true")
    expect(balanceAfter - balanceBefore).toBe(1n)
  })

  test.skip("should send a user operation using nexusClient.sendUserOperation", async () => {
    const balanceBefore = await publicClient.getBalance({
      address: recipientAddress
    })
    const userOpHash = await nexusClient.sendUserOperation({
      calls: [{ to: recipientAddress, value: 1n }]
    })
    const { success } = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHash
    })
    const balanceAfter = await publicClient.getBalance({
      address: recipientAddress
    })
    expect(success).toBe("true")
    expect(balanceAfter - balanceBefore).toBe(1n)
  })
})
