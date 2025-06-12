import { COUNTER_ADDRESS, MEE_VALIDATOR_ADDRESS } from "@biconomy/ecosystem"
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
import { toNetwork } from "../../../test/testSetup"
import {
  getBalance,
  getTestAccount,
  killNetwork,
  toTestClient,
  topUp
} from "../../../test/testUtils"
import type { MasterClient, NetworkConfig } from "../../../test/testUtils"
import { NexusAccount, toNexusAccount } from "../../account/toNexusAccount"
import { Logger } from "../../account/utils/Logger"
import {
  type EthersWallet,
  getAccountMeta,
  makeInstallDataAndHash
} from "../../account/utils/Utils"
import { getChain } from "../../account/utils/getChain"
import { toMeeK1Module } from "../../modules/validators/meeK1/toMeeK1Module"
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
  let nexusAccount_1_0_2_with_k1: NexusAccount
  let nexusAccount_1_0_2_custom_validator: NexusAccount
  let nexusClient_1_0_2_with_k1: NexusClient
  let nexusClient_1_0_2_custom_validator: NexusClient
  let privKey_1_0_2: Hex
  let clients: NexusClient[]
  let nexusAccount_1_0_2_with_k1_Address: Address
  let nexusAccount_1_0_2_custom_validator_Address: Address
  // TODO mapping => client with addresses

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

    nexusAccount_1_0_2_with_k1 = await toNexusAccount({
      signer: account_1_0_2,
      chain: chain_1_0_2,
      transport: http(),
      useK1Config: true,
      nexusVersion: "1.0.2"
    })

    nexusClient_1_0_2_with_k1 = createSmartAccountClient({
      bundlerUrl: bundlerUrl_1_0_2,
      account: nexusAccount_1_0_2_with_k1,
      mock: true
    })

    nexusAccount_1_0_2_custom_validator = await toNexusAccount({
      signer: account_1_0_2,
      chain: chain_1_0_2,
      transport: http(),
      useK1Config: false,
      nexusVersion: "1.0.2",
      validators: [
        toMeeK1Module({ signer: account_1_0_2, module: MEE_VALIDATOR_ADDRESS })
      ]
    })

    nexusClient_1_0_2_custom_validator = createSmartAccountClient({
      bundlerUrl: bundlerUrl_1_0_2,
      account: nexusAccount_1_0_2_custom_validator,
      mock: true
    })

    clients = [
      nexusClient_1_0_2_with_k1,
      nexusClient_1_0_2_custom_validator
    ]

    nexusAccount_1_0_2_with_k1_Address = await nexusAccount_1_0_2_with_k1.getAddress()
    nexusAccount_1_0_2_custom_validator_Address = await nexusAccount_1_0_2_custom_validator.getAddress()
    
    
  })
  afterAll(async () => {
    await killNetwork([network_1_0_2?.rpcPort, network_1_0_2?.bundlerPort])
  })

  test("should deploy Nexus 1.0.2 smart account if not deployed", async () => {
    for (const client of clients) {
      const accountAddress = await client.account.getAddress()
      const isDeployed = await client.account.isDeployed()
      if (!isDeployed) {
        // Fund the account first
        await topUp(testClient_1_0_2, accountAddress, parseEther("0.1"))

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
          hash
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

  test("should fund the smart account", async () => {
    for (const client of clients) { 
      await topUp(testClient_1_0_2, __client.address__, parseEther("0.01"))

      const balance = await getBalance(testClient_1_0_2, _client_address_)
      expect(balance > 0)
   }
  })

  test("should have account addresses", async () => {
    for (const client of clients) {
      const addresses = await Promise.all([
        eoaAccount.address,
        client.account.getAddress()
      ])
      expect(addresses.every(Boolean)).to.be.true
      expect(addresses.every((address) => isHex(address))).toBe(true)
    }
  })

  test("should estimate gas for writing to a contract", async () => {
    for (const client of clients) {
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
          // todo: add value? 
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
