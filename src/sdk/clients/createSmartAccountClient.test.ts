import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { Wallet, ethers } from "ethers"
import {
  http,
  type Account,
  type Address,
  type Chain,
  type Hex,
  encodeFunctionData,
  isHex,
  parseEther
} from "viem"
import type { UserOperationReceipt } from "viem/account-abstraction"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { CounterAbi } from "../../test/__contracts/abi"
import { toNetwork } from "../../test/testSetup"
import {
  getBalance,
  getTestAccount,
  killNetwork,
  toTestClient,
  topUp
} from "../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../test/testUtils"
import { toNexusAccount } from "../account/toNexusAccount"
import { Logger } from "../account/utils/Logger"
import {
  type EthersWallet,
  getAccountMeta,
  makeInstallDataAndHash
} from "../account/utils/Utils"
import { getChain } from "../account/utils/getChain"
import {
  type NexusClient,
  createSmartAccountClient
} from "./createBicoBundlerClient"

describe("nexus.client", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: Account
  let recipientAccount: Account
  let recipientAddress: Address
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let privKey: Hex

  beforeAll(async () => {
    network = await toNetwork()

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    recipientAccount = getTestAccount(1)
    recipientAddress = recipientAccount.address

    testClient = toTestClient(chain, getTestAccount(5))

    privKey = generatePrivateKey()
    const account = privateKeyToAccount(privKey)

    const nexusAccount = await toNexusAccount({
      signer: account,
      chain,
      transport: http()
    })

    nexusClient = createSmartAccountClient({
      bundlerUrl,
      account: nexusAccount,
      mock: true
    })
    nexusAccountAddress = await nexusAccount.getAddress()
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should deploy smart account if not deployed", async () => {
    const isDeployed = await nexusClient.account.isDeployed()

    if (!isDeployed) {
      // Fund the account first
      await topUp(testClient, nexusAccountAddress, parseEther("0.01"))

      const hash = await nexusClient.sendTransaction({
        calls: [
          {
            to: nexusAccountAddress,
            value: 0n,
            data: "0x"
          }
        ]
      })
      const { status } = await nexusClient.waitForTransactionReceipt({
        hash
      })
      expect(status).toBe("success")

      const isNowDeployed = await nexusClient.account.isDeployed()
      expect(isNowDeployed).toBe(true)
    } else {
      console.log("Smart account already deployed")
    }

    // Verify the account is now deployed
    const finalDeploymentStatus = await nexusClient.account.isDeployed()
    expect(finalDeploymentStatus).toBe(true)
  })

  test("should fund the smart account", async () => {
    await topUp(testClient, nexusAccountAddress, parseEther("0.01"))

    const balance = await getBalance(testClient, nexusAccountAddress)
    expect(balance > 0)
  })

  test("should have account addresses", async () => {
    const addresses = await Promise.all([
      eoaAccount.address,
      nexusClient.account.getAddress()
    ])
    expect(addresses.every(Boolean)).to.be.true
    expect(addresses.every((address) => isHex(address))).toBe(true)
  })

  test("should estimate gas for writing to a contract", async () => {
    const encodedCall = encodeFunctionData({
      abi: CounterAbi,
      functionName: "incrementNumber"
    })
    const call = {
      to: COUNTER_ADDRESS as Address,
      data: encodedCall
    }
    const results = await Promise.all([
      nexusClient.estimateUserOperationGas({ calls: [call] }),
      nexusClient.estimateUserOperationGas({ calls: [call, call] })
    ])

    const increasingGasExpenditure = results.every(
      ({ preVerificationGas }, i) =>
        preVerificationGas > (results[i - 1]?.preVerificationGas ?? 0)
    )

    expect(increasingGasExpenditure).toBeTruthy()
  }, 60000)

  test("should check enable mode", async () => {
    const { name, version } = await getAccountMeta(
      testClient,
      nexusAccountAddress
    )

    const result = makeInstallDataAndHash(
      eoaAccount.address,
      [
        {
          type: "validator",
          config: eoaAccount.address
        }
      ],
      name,
      version
    )

    expect(result).toBeTruthy()
  }, 30000)

  test("should read estimated user op gas values", async () => {
    const userOp = await nexusClient.prepareUserOperation({
      calls: [
        {
          to: recipientAccount.address,
          data: "0x"
        }
      ]
    })

    const estimatedGas = await nexusClient.estimateUserOperationGas(userOp)
    expect(estimatedGas.verificationGasLimit).toBeTruthy()
    expect(estimatedGas.callGasLimit).toBeTruthy()
    expect(estimatedGas.preVerificationGas).toBeTruthy()
  }, 30000)

  test("should return chain object for chain id 1", async () => {
    const chainId = 1
    const chain = getChain(chainId)
    expect(chain.id).toBe(chainId)
  })

  test("should have correct fields", async () => {
    const chainId = 1
    const chain = getChain(chainId)
    ;[
      "blockExplorers",
      "contracts",
      "fees",
      "formatters",
      "id",
      "name",
      "nativeCurrency",
      "rpcUrls",
      "serializers"
    ].every((field) => {
      expect(chain).toHaveProperty(field)
    })
  })

  test("should throw an error, chain id not found", async () => {
    const chainId = 0
    expect(() => getChain(chainId)).toThrow("Chain 0 not found.")
  })

  test("should have attached erc757 actions", async () => {
    const [
      accountId,
      isModuleInstalled,
      supportsExecutionMode,
      supportsModule
    ] = await Promise.all([
      nexusClient.accountId(),
      nexusClient.isModuleInstalled({
        module: {
          type: "validator",
          address: nexusClient.account.getModule().address,
          initData: "0x"
        }
      }),
      nexusClient.supportsExecutionMode({
        type: "delegatecall"
      }),
      nexusClient.supportsModule({
        type: "validator"
      })
    ])
    expect(accountId.indexOf("biconomy.nexus") > -1).toBe(true)
    expect(isModuleInstalled).toBe(false)
    expect(supportsExecutionMode).toBe(true)
    expect(supportsModule).toBe(true)
  })

  test("should send eth twice", async () => {
    const balanceBefore = await getBalance(testClient, recipientAddress)
    const tx = { to: recipientAddress, value: 1n }
    const hash = await nexusClient.sendTransaction({ calls: [tx, tx] })
    const { status } = await nexusClient.waitForTransactionReceipt({ hash })
    const balanceAfter = await getBalance(testClient, recipientAddress)
    expect(status).toBe("success")
    expect(balanceAfter - balanceBefore).toBe(2n)
  })

  test("should compare signatures of viem and ethers signer", async () => {
    const viemSigner = privateKeyToAccount(privKey)
    const wallet = new Wallet(privKey)

    const viemAccount = await toNexusAccount({
      signer: viemSigner,
      chain,
      transport: http()
    })

    const ethersAccount = await toNexusAccount({
      signer: wallet as EthersWallet,
      chain,
      transport: http()
    })

    const viemNexusClient = createSmartAccountClient({
      bundlerUrl,
      account: viemAccount,
      mock: true
    })

    const ethersNexusClient = createSmartAccountClient({
      bundlerUrl,
      account: ethersAccount,
      mock: true
    })

    const sig1 = await viemNexusClient.signMessage({ message: "123" })
    const sig2 = await ethersNexusClient.signMessage({ message: "123" })

    expect(sig1).toBe(sig2)
  })

  test("should send user operation using ethers Wallet", async () => {
    const ethersWallet = new ethers.Wallet(privKey)

    const ethersAccount = await toNexusAccount({
      signer: ethersWallet as EthersWallet,
      chain,
      transport: http()
    })

    const ethersNexusClient = createSmartAccountClient({
      bundlerUrl,
      account: ethersAccount,
      mock: true
    })

    const hash = await ethersNexusClient.sendUserOperation({
      calls: [
        {
          to: recipientAddress,
          data: "0x"
        }
      ]
    })
    const receipt = await ethersNexusClient.waitForUserOperationReceipt({
      hash
    })
    expect(receipt.success).toBe(true)
  })

  test("should send sequential user ops", async () => {
    const start = performance.now()
    const receipts: UserOperationReceipt[] = []
    for (let i = 0; i < 3; i++) {
      const hash = await nexusClient.sendUserOperation({
        calls: [
          {
            to: recipientAddress,
            value: 1n
          }
        ]
      })
      const receipt = await nexusClient.waitForUserOperationReceipt({ hash })
      receipts.push(receipt)
    }
    expect(receipts.every((receipt) => receipt.success)).toBeTruthy()
    const end = performance.now()
    Logger.log(`Time taken: ${end - start} milliseconds`)
  })

  test("should send parallel user ops", async () => {
    const start = performance.now()
    const userOpPromises: Promise<`0x${string}`>[] = []
    for (let i = 0; i < 3; i++) {
      userOpPromises.push(
        nexusClient.sendUserOperation({
          calls: [
            {
              to: recipientAddress,
              value: 1n
            }
          ]
        })
      )
    }
    const hashes = await Promise.all(userOpPromises)
    expect(hashes.length).toBe(3)
    const receipts = await Promise.all(
      hashes.map((hash) => nexusClient.waitForUserOperationReceipt({ hash }))
    )
    expect(receipts.every((receipt) => receipt.success)).toBeTruthy()
    const end = performance.now()
    Logger.log(`Time taken: ${end - start} milliseconds`)
  })
})
