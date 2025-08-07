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
import { CounterAbi } from "../../../test/__contracts/abi"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../../test/testSetup"
import {
  getBalance,
  getTestAccount,
  killNetwork,
  toTestClient,
  topUp
} from "../../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../account/toNexusAccount"
import { Logger } from "../../account/utils/Logger"
import {
  type EthersWallet,
  getAccountMeta,
  makeInstallDataAndHash
} from "../../account/utils/Utils"
import { getChain } from "../../account/utils/getChain"
import { MEEVersion } from "../../constants"
import { getMEEVersion } from "../../modules"
import {
  type NexusClient,
  createSmartAccountClient
} from "../createBicoBundlerClient"

describe("nexus.client.1.0.2", async () => {
  let network_1_0_2: NetworkConfig
  let chain_1_0_2: Chain
  let bundlerUrl_1_0_2: string

  // Test utils
  let testClient_1_0_2: MasterClient
  let eoaAccount: Account
  let recipientAccount: Account
  let recipientAddress: Address
  let nexusAccount_1_0_2_custom_validator: NexusAccount
  let nexusClient_1_0_2_custom_validator: NexusClient
  let privKey_1_0_2: Hex
  const clientToAddress: Map<NexusClient, Address> = new Map()

  beforeAll(async () => {
    // fork base sepolia as it has all the 1.0.2 infra (nexus, registry, modules, attesters) deployed and configured
    network_1_0_2 = await toNetwork(
      "BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA"
    )
    chain_1_0_2 = network_1_0_2.chain
    bundlerUrl_1_0_2 = network_1_0_2.bundlerUrl

    eoaAccount = getTestAccount(0)
    recipientAccount = getTestAccount(1)
    recipientAddress = recipientAccount.address

    testClient_1_0_2 = toTestClient(chain_1_0_2, getTestAccount(5))

    privKey_1_0_2 = generatePrivateKey()
    const account_1_0_2 = privateKeyToAccount(privKey_1_0_2)

    nexusAccount_1_0_2_custom_validator = await toNexusAccount({
      signer: account_1_0_2,
      chainConfiguration: {
        chain: chain_1_0_2,
        transport: http(network_1_0_2.rpcUrl),
        version: getMEEVersion(MEEVersion.V1_0_0)
      }
    })

    nexusClient_1_0_2_custom_validator = createSmartAccountClient({
      bundlerUrl: bundlerUrl_1_0_2,
      account: nexusAccount_1_0_2_custom_validator,
      mock: true
    })

    clientToAddress.set(
      nexusClient_1_0_2_custom_validator,
      await nexusAccount_1_0_2_custom_validator.getAddress()
    )
  })
  afterAll(async () => {
    await killNetwork([network_1_0_2?.rpcPort, network_1_0_2?.bundlerPort])
  })

  test("should fund the smart account", async () => {
    for (const [, accountAddress] of clientToAddress.entries()) {
      await topUp(testClient_1_0_2, accountAddress, parseEther("1"))
      const balance = await getBalance(testClient_1_0_2, accountAddress)
      expect(balance > 0)
    }
  })

  test("should deploy Nexus 1.0.2 smart account if not deployed", async () => {
    for (const [client, accountAddress] of clientToAddress.entries()) {
      const isDeployed = await client.account.isDeployed()
      if (!isDeployed) {
        const hash = await client.sendTransaction({
          calls: [
            {
              to: accountAddress,
              value: 0n,
              data: "0x"
            }
          ]
        })
        const { status } = await client.waitForTransactionReceipt({
          hash,
          confirmations: TEST_BLOCK_CONFIRMATIONS
        })
        expect(status).toBe("success")

        const isNowDeployed = await client.account.isDeployed()
        expect(isNowDeployed).toBe(true)
      } else {
        console.log("Smart account already deployed")
      }

      // Verify the account is now deployed
      const finalDeploymentStatus = await client.account.isDeployed()
      expect(finalDeploymentStatus).toBe(true)
    }
  })

  test("should have account addresses", async () => {
    for (const [client] of clientToAddress.entries()) {
      const addresses = await Promise.all([
        eoaAccount.address,
        client.account.getAddress()
      ])
      expect(addresses.every(Boolean)).to.be.true
      expect(addresses.every((address) => isHex(address))).toBe(true)
    }
  })

  test("should estimate gas for writing to a contract", async () => {
    for (const [client] of clientToAddress.entries()) {
      const encodedCall = encodeFunctionData({
        abi: CounterAbi,
        functionName: "incrementNumber"
      })
      const call = {
        to: COUNTER_ADDRESS as Address,
        data: encodedCall
      }
      const results = await Promise.all([
        client.estimateUserOperationGas({ calls: [call] }),
        client.estimateUserOperationGas({ calls: [call, call] })
      ])

      const increasingGasExpenditure = results.every(
        ({ preVerificationGas }, i) =>
          preVerificationGas > (results[i - 1]?.preVerificationGas ?? 0)
      )

      expect(increasingGasExpenditure).toBeTruthy()
    }
  }, 60000)

  test("should check enable mode", async () => {
    for (const [, accountAddress] of clientToAddress.entries()) {
      const { name, version } = await getAccountMeta(
        testClient_1_0_2,
        accountAddress
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
    }
  }, 30000)

  test("should read estimated user op gas values", async () => {
    for (const [client, accountAddress] of clientToAddress.entries()) {
      const userOp = await client.prepareUserOperation({
        calls: [
          {
            to: recipientAccount.address,
            data: "0x"
          }
        ]
      })

      const estimatedGas = await client.estimateUserOperationGas(userOp)
      expect(estimatedGas.verificationGasLimit).toBeTruthy()
      expect(estimatedGas.callGasLimit).toBeTruthy()
      expect(estimatedGas.preVerificationGas).toBeTruthy()
    }
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
    for (const [client, accountAddress] of clientToAddress.entries()) {
      const [
        accountId,
        isModuleInstalled,
        supportsExecutionMode,
        supportsModule
      ] = await Promise.all([
        client.accountId(),
        client.isModuleInstalled({
          module: {
            type: "validator",
            address: client.account.getModule().address,
            initData: "0x"
          }
        }),
        client.supportsExecutionMode({
          type: "delegatecall"
        }),
        client.supportsModule({
          type: "validator"
        })
      ])
      expect(accountId.indexOf("biconomy.nexus") > -1).toBe(true)
      expect(isModuleInstalled).toBe(true)
      expect(supportsExecutionMode).toBe(true)
      expect(supportsModule).toBe(true)
    }
  })

  test("should send eth twice", async () => {
    for (const [client, accountAddress] of clientToAddress.entries()) {
      const balanceBefore = await getBalance(testClient_1_0_2, recipientAddress)
      const tx = { to: recipientAddress, value: 1n }
      const hash = await client.sendTransaction({ calls: [tx, tx] })
      const { status } = await client.waitForTransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
      const balanceAfter = await getBalance(testClient_1_0_2, recipientAddress)
      expect(status).toBe("success")
      expect(balanceAfter - balanceBefore).toBe(2n)
    }
  })

  test("should compare signatures of viem and ethers signer", async () => {
    const wallet = new Wallet(privKey_1_0_2)

    const ethersAccount2 = await toNexusAccount({
      signer: wallet as EthersWallet,
      chainConfiguration: {
        chain: chain_1_0_2,
        transport: http(network_1_0_2.rpcUrl),
        version: getMEEVersion(MEEVersion.V1_0_0)
      }
    })

    const ethersNexusClient2 = createSmartAccountClient({
      bundlerUrl: bundlerUrl_1_0_2,
      account: ethersAccount2,
      mock: true
    })

    const sig1 = await nexusClient_1_0_2_custom_validator.signMessage({
      message: "123"
    })
    const sig2 = await ethersNexusClient2.signMessage({ message: "123" })

    expect(sig1).toBe(sig2)
  })

  test("should send user operation using ethers Wallet", async () => {
    const ethersWallet = new ethers.Wallet(privKey_1_0_2)

    const ethersAccount = await toNexusAccount({
      signer: ethersWallet as EthersWallet,
      chainConfiguration: {
        chain: chain_1_0_2,
        transport: http(network_1_0_2.rpcUrl),
        version: getMEEVersion(MEEVersion.V1_0_0)
      }
    })

    const ethersNexusClient = createSmartAccountClient({
      bundlerUrl: bundlerUrl_1_0_2,
      account: ethersAccount,
      mock: true
    })

    const etherAccountCustomValidator = await toNexusAccount({
      signer: ethersWallet as EthersWallet,
      chainConfiguration: {
        chain: chain_1_0_2,
        transport: http(network_1_0_2.rpcUrl),
        version: getMEEVersion(MEEVersion.V1_0_0)
      }
    })

    const ethersNexusClient2 = createSmartAccountClient({
      bundlerUrl: bundlerUrl_1_0_2,
      account: etherAccountCustomValidator,
      mock: true
    })

    //fund the account
    await topUp(testClient_1_0_2, ethersAccount.address, parseEther("0.1"))
    await topUp(
      testClient_1_0_2,
      etherAccountCustomValidator.address,
      parseEther("0.1")
    )

    const clients = [ethersNexusClient, ethersNexusClient2]

    for (const client of clients) {
      const hash = await client.sendUserOperation({
        calls: [
          {
            to: recipientAddress,
            data: "0x",
            value: 1n
          }
        ]
      })
      const receipt = await ethersNexusClient.waitForUserOperationReceipt({
        hash
      })
      expect(receipt.success).toBe(true)
    }
  })

  test("should send a single user operation", async () => {
    for (const [client] of clientToAddress.entries()) {
      const hash = await client.sendUserOperation({
        calls: [
          {
            to: recipientAddress,
            data: "0x",
            value: 1n
          }
        ]
      })
      const receipt = await client.waitForUserOperationReceipt({ hash })
      expect(receipt.success).toBe(true)
    }
  })

  test("should send sequential user ops", async () => {
    for (const [client] of clientToAddress.entries()) {
      const start = performance.now()
      const receipts: UserOperationReceipt[] = []
      for (let i = 0; i < 3; i++) {
        const hash = await client.sendUserOperation({
          calls: [
            {
              to: recipientAddress,
              value: 1n
            }
          ]
        })
        const receipt = await client.waitForUserOperationReceipt({ hash })
        receipts.push(receipt)
      }
      expect(receipts.every((receipt) => receipt.success)).toBeTruthy()
      const end = performance.now()
      Logger.log(`Time taken: ${end - start} milliseconds`)
    }
  })

  test("should send parallel user ops", async () => {
    for (const [client] of clientToAddress.entries()) {
      const start = performance.now()
      const userOpPromises: Promise<`0x${string}`>[] = []
      for (let i = 0; i < 3; i++) {
        userOpPromises.push(
          client.sendUserOperation({
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
        hashes.map((hash) => client.waitForUserOperationReceipt({ hash }))
      )
      expect(receipts.every((receipt) => receipt.success)).toBeTruthy()
      const end = performance.now()
      Logger.log(`Time taken: ${end - start} milliseconds`)
    }
  })
})
