import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import {
  http,
  type Address,
  type Chain,
  type Hex,
  type PrivateKeyAccount,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  parseEther,
  erc20Abi
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
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
import { mcUSDC, mcUSDD, SmartSessionMode } from "../sdk/constants"
import type {
  CreateSessionDataParams,
  SessionData
} from "../sdk/modules/validators/smartSessions/Types"
import { toSmartSessionsModule } from "../sdk/modules/validators/smartSessions/toSmartSessionsModule"
import { CounterAbi } from "./__contracts/abi/CounterAbi"
import { toNetwork } from "./testSetup"
import type { NetworkConfig } from "./testUtils"
import buildComposable from "../sdk/account/decorators/instructions/buildComposable"
import { base, optimism, polygon } from "viem/chains"
import { toMultichainNexusAccount } from "../sdk/account"
import { privateKeyToAccount } from "viem/accounts"

describe.skipIf(!playgroundTrue())("playground", () => {
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

    recipientAddress = eoaAccount.address

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http()
    })

    publicClient = createPublicClient({
      chain,
      transport: http()
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
        chain,
        signer: eoaAccount,
        transport: http()
      }),
      transport: http(bundlerUrl),
      ...(paymasterParams ? paymasterParams : {})
    })
  })

  test("should log relevant addresses", async () => {
    nexusAccountAddress = await nexusClient.account.getCounterFactualAddress()
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

    console.log({ ownerBalance, smartAccountBalance })

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
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe("success")
      const [ownerBalanceTwo, smartAccountBalanceTwo] = await Promise.all([
        publicClient.getBalance({
          address: eoaAccount.address
        }),
        publicClient.getBalance({
          address: nexusAccountAddress
        })
      ])
      console.log({ ownerBalanceTwo, smartAccountBalanceTwo })
    }
    expect(balancesAreOfCorrectType).toBeTruthy()
  })

  test("should send some native token", async () => {
    const balanceBefore = await publicClient.getBalance({
      address: recipientAddress
    })
    const hash = await nexusClient.sendTransaction({
      calls: [
        {
          to: recipientAddress,
          value: 1n
        }
      ]
    })
    const { status } = await publicClient.waitForTransactionReceipt({ hash })
    const balanceAfter = await publicClient.getBalance({
      address: recipientAddress
    })
    expect(status).toBe("success")
    expect(balanceAfter - balanceBefore).toBe(1n)
  })

  test("should send a user operation using nexusClient.sendUserOperation", async () => {
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

  test("should execute composable", async () => {

    const mcNexus = await toMultichainNexusAccount({
      chains: [optimism, base, polygon],
      signer: privateKeyToAccount('0x'),
      transports: [http(), http(), http()]
    })


  })

})
