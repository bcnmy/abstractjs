import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  encodeFunctionData,
  parseAbi
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../../test/testSetup"
import {
  type MasterClient,
  type NetworkConfig,
  fundAndDeployClients,
  getTestAccount,
  killNetwork,
  toTestClient,
  topUp
} from "../../../../test/testUtils"
import { type NexusAccount, addressEquals } from "../../../account"
import { toNexusAccount } from "../../../account/toNexusAccount"
import { LATEST_DEFAULT_ADDRESSES } from "../../../constants"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../createBicoBundlerClient"

describe("decorators.smartAccount.upgradeSmartAccount", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string

  // Test utils
  let testClient: MasterClient
  let eoaAccount: LocalAccount
  const OLD_ACCOUNT_ADDRESS_FOR_EOA =
    "0x1cd0667b990e41499E6113094dD6D05D003B7A85"

  const NFT_ADDRESS_BASE_SEPOLIA = "0x1758f42Af7026fBbB559Dc60EcE0De3ef81f665e"

  let oldNexusClient: NexusClient
  let oldNexusAccountAddress: Address
  let oldNexusAccount: NexusAccount
  let newNexusAccount: NexusAccount
  let newNexusAccountAddress: Address
  beforeAll(async () => {
    network = await toNetwork("BESPOKE_ANVIL_NETWORK_FORKING_BASE_SEPOLIA")

    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = getTestAccount(0)
    testClient = toTestClient(chain, getTestAccount(5))

    oldNexusAccount = await toNexusAccount({
      chain,
      signer: eoaAccount,
      transport: http(),
      oldVersion: "0.0.33"
    })

    oldNexusClient = createSmartAccountClient({
      account: oldNexusAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    // Create a new but don't deploy it yet
    newNexusAccount = await toNexusAccount({
      chain,
      signer: eoaAccount,
      transport: http()
    })

    oldNexusAccountAddress = await oldNexusAccount.getAddress()
    newNexusAccountAddress = await newNexusAccount.getAddress()

    await fundAndDeployClients(testClient, [oldNexusClient]) // Deploy the old account
    await topUp(testClient, newNexusAccountAddress) // Fund the new account but don't deploy it yet
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should have an old funded account", async () => {
    const balance = await testClient.getBalance({
      address: oldNexusAccountAddress
    })
    expect(balance).toBeGreaterThan(0)
    expect(
      addressEquals(oldNexusAccountAddress, OLD_ACCOUNT_ADDRESS_FOR_EOA)
    ).toBeTruthy()
  })

  test("should be deployed", async () => {
    const isDeployed = await oldNexusClient.account.isDeployed()
    expect(isDeployed).toBeTruthy()
  })

  test("should have an old accountId for the old account", async () => {
    const accountId = await oldNexusClient.accountId()
    expect(accountId).toBe("biconomy.nexus.1.0.0")
  })

  // https://biconomy.notion.site/Technical-Notice-Nexus-Account-ERC-721-Handler-Hotfix-Release-1ab75fdf326480369f10d776cd3ca813
  test("should fail to mint NFT with a biconomy.nexus.1.0.0 account", async () => {
    await expect(
      oldNexusClient.sendUserOperation({
        calls: [
          {
            to: NFT_ADDRESS_BASE_SEPOLIA,
            data: encodeFunctionData({
              abi: parseAbi(["function safeMint(address to) public"]),
              functionName: "safeMint",
              args: [oldNexusAccountAddress]
            })
          }
        ]
      })
    ).rejects.toThrow()
  })

  test("expect the new account not to have been deployed yet", async () => {
    const isDeployed = await newNexusAccount.isDeployed()
    expect(isDeployed).toBeFalsy()
  })

  test("should now migrate the old account to biconomy.nexus.1.0.2", async () => {
    // Upgrade the account to the latest implementation
    const hash = await oldNexusClient.upgradeSmartAccount()

    // Wait for the upgrade transaction to be processed
    const receipt = await oldNexusClient.waitForUserOperationReceipt({ hash })
    expect(receipt.success).toBe(true)

    // Verify the account has been upgraded
    const accountId = await oldNexusClient.accountId()
    expect(accountId).toBe(LATEST_DEFAULT_ADDRESSES.accountId)
  })

  test("expect the new account to have been deployed", async () => {
    // Now try to mint an NFT with the upgraded account
    const mintHash = await oldNexusClient.sendUserOperation({
      calls: [
        {
          to: NFT_ADDRESS_BASE_SEPOLIA,
          data: encodeFunctionData({
            abi: parseAbi(["function safeMint(address to) public"]),
            functionName: "safeMint",
            args: [oldNexusAccountAddress]
          })
        }
      ]
    })

    const mintReceipt = await oldNexusClient.waitForUserOperationReceipt({
      hash: mintHash
    })
    expect(mintReceipt.success).toBe(true)
  })
})
