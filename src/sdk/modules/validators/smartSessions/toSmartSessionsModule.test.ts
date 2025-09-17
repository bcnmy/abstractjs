import {
  COUNTER_ADDRESS,
  type Ecosystem,
  type Infra,
  getRandomNumber,
  toClients,
  toEcosystem
} from "@biconomy/ecosystem"
import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient,
  getAbiItem,
  parseAbi,
  parseEther,
  toFunctionSelector
} from "viem"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { getTestAccount, killNetwork } from "../../../../test/testUtils"
import { type NexusAccount, toNexusAccount } from "../../../account"
import {
  type NexusClient,
  createSmartAccountClient
} from "../../../clients/createBicoBundlerClient"
import { DEFAULT_MEE_VERSION, getSudoPolicy } from "../../../constants"
import { CounterAbi } from "../../../constants/abi/CounterAbi"
import { getMEEVersion } from "../../utils"
import { smartSessionActions } from "./decorators"
import type { GrantPermissionResponse } from "./decorators/grantPermission"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

describe("modules.toSmartSessionsModule", () => {
  let ecosystem: Ecosystem
  let infra: Infra
  let chain: Chain
  let secondInfra: Infra
  let secondChain: Chain
  let bundlerUrl: string
  let secondBundlerUrl: string
  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount
  let redeemerAddress: Address
  let nexusAccount: NexusAccount
  let nexusClient: NexusClient
  let nexusAccountAddress: Address
  let secondChainNexusAccount: NexusAccount
  let secondChainNexusClient: NexusClient
  let sessionDetails: GrantPermissionResponse
  let sessionDetailsTypedDataSign: GrantPermissionResponse
  let publicClient: PublicClient
  let secondChainPublicClient: PublicClient

  beforeAll(async () => {
    ecosystem = await toEcosystem({
      chainLength: 2
    })
    infra = ecosystem.infras[0]
    secondInfra = ecosystem.infras[1]
    chain = infra.network.chain
    secondChain = secondInfra.network.chain
    bundlerUrl = infra.bundler.url
    secondBundlerUrl = secondInfra.bundler.url
    eoaAccount = getTestAccount(0)
    redeemerAccount = getTestAccount(1)
    redeemerAddress = redeemerAccount.address

    publicClient = createPublicClient({
      chain,
      transport: http(infra.network.rpcUrl)
    })

    secondChainPublicClient = createPublicClient({
      chain: secondChain,
      transport: http(secondInfra.network.rpcUrl)
    })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const { testClient } = await toClients(infra.network)
    const { testClient: secondTestClient } = await toClients(
      secondInfra.network
    )

    nexusClient = createSmartAccountClient({
      bundlerUrl,
      account: nexusAccount,
      mock: true
    })

    // prepare Nexus account for a second chain
    secondChainNexusAccount = await toNexusAccount({
      ...nexusAccount,
      chainConfiguration: {
        chain: secondChain,
        transport: http(secondInfra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    secondChainNexusClient = createSmartAccountClient({
      bundlerUrl: secondBundlerUrl,
      account: secondChainNexusAccount,
      mock: true
    })

    nexusAccountAddress = await nexusAccount.getAddress()
    await testClient.setBalance({
      address: nexusAccountAddress,
      value: parseEther("100")
    })
    await secondTestClient.setBalance({
      address: secondChainNexusAccount.address,
      value: parseEther("100")
    })
  })
  afterAll(async () => {
    await killNetwork([infra.network.rpcPort, infra.bundler.port])
  })

  test("install the smart sessions module for both chains", async () => {
    const smartSessionsModule = toSmartSessionsModule({ signer: eoaAccount })

    // Install the smart sessions module on the Nexus client's smart contract account
    const hash = await nexusClient.installModule({
      module: smartSessionsModule
    })

    // Wait for the module installation transaction to be mined and check its success
    const { success: installSuccess } =
      await nexusClient.waitForUserOperationReceipt({ hash })

    expect(installSuccess).toBe(true)

    const secondChainHash = await secondChainNexusClient.installModule({
      module: smartSessionsModule
    })

    const { success: secondChainInstallSuccess } =
      await secondChainNexusClient.waitForUserOperationReceipt({
        hash: secondChainHash
      })
    expect(secondChainInstallSuccess).toBe(true)
  })

  test("grant a permission with typed data sign", async () => {
    // extend the Nexus client with the smart sessions actions
    const smartSessionsClient = nexusClient.extend(smartSessionActions())

    sessionDetailsTypedDataSign =
      await smartSessionsClient.grantPermissionTypedDataSign([
        {
          redeemer: redeemerAddress,
          actions: [
            {
              actionTarget: COUNTER_ADDRESS,
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              ),
              actionPolicies: [getSudoPolicy()]
            }
          ],
          chainId: BigInt(chain.id)
        },
        {
          redeemer: redeemerAddress,
          actions: [
            {
              actionTarget: COUNTER_ADDRESS,
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              ),
              actionPolicies: [getSudoPolicy()]
            }
          ],
          // for the chains different from the smart sessions client chain,
          // it is required to pass the account instance for this chain id
          account: secondChainNexusAccount
        }
      ])
  })

  test("use a permission with typed data sign", async () => {
    const counterBefore = await publicClient.readContract({
      address: COUNTER_ADDRESS,
      abi: parseAbi(["function getNumber() view returns (uint256)"]),
      functionName: "getNumber"
    })

    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashTypedDataSignOne = await smartSessionsClient.usePermission({
      sessionDetailsArray: sessionDetailsTypedDataSign,
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          )
        }
      ],
      mode: "ENABLE_AND_USE",
      verificationGasLimit: 20000000n
    })
    const receiptTypedDataSignOne =
      await nexusClient.waitForUserOperationReceipt({
        hash: userOpHashTypedDataSignOne
      })
    if (!receiptTypedDataSignOne.success) {
      throw new Error("Smart sessions module validation failed")
    }

    const counterAfter = await publicClient.readContract({
      address: COUNTER_ADDRESS,
      abi: CounterAbi,
      functionName: "getNumber"
    })
    expect(counterAfter).toBe(counterBefore + 1n)
  })

  test("use a permission with typed data sign for a second chain", async () => {
    const counterBefore = await secondChainPublicClient.readContract({
      address: COUNTER_ADDRESS,
      abi: CounterAbi,
      functionName: "getNumber"
    })

    const emulatedAccount = await toNexusAccount({
      accountAddress: secondChainNexusAccount.address,
      signer: redeemerAccount,
      chainConfiguration: {
        chain: secondChain,
        transport: http(secondInfra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(secondBundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashTypedDataSignSecondChain =
      await smartSessionsClient.usePermission({
        sessionDetailsArray: sessionDetailsTypedDataSign,
        calls: [
          {
            to: COUNTER_ADDRESS,
            data: toFunctionSelector(
              getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
            )
          }
        ],
        mode: "ENABLE_AND_USE"
      })

    const receiptTypedDataSignSecondChain =
      await secondChainNexusClient.waitForUserOperationReceipt({
        hash: userOpHashTypedDataSignSecondChain
      })
    expect(receiptTypedDataSignSecondChain.success).toBe(true)

    const counterAfter = await secondChainPublicClient.readContract({
      address: COUNTER_ADDRESS,
      abi: CounterAbi,
      functionName: "getNumber"
    })
    expect(counterAfter).toBe(counterBefore + 1n)
  })

  test("use a permission with typed data sign a second time", async () => {
    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashTwoTypedDataSign = await smartSessionsClient.usePermission({
      sessionDetailsArray: sessionDetailsTypedDataSign,
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          )
        }
      ],
      mode: "USE"
    })

    const receiptTwoTypedDataSign =
      await nexusClient.waitForUserOperationReceipt({
        hash: userOpHashTwoTypedDataSign
      })
    expect(receiptTwoTypedDataSign.success).toBe(true)
  })

  test("grant a permission with personal sign", async () => {
    const smartSessionsClient = nexusClient.extend(smartSessionActions())
    sessionDetails = await smartSessionsClient.grantPermissionPersonalSign([
      {
        redeemer: redeemerAddress,
        actions: [
          {
            actionTarget: COUNTER_ADDRESS,
            actionTargetSelector: toFunctionSelector(
              getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
            ),
            actionPolicies: [getSudoPolicy()]
          }
        ]
      },
      // decrement the counter as a separate permission
      {
        redeemer: redeemerAddress,
        actions: [
          {
            actionTarget: COUNTER_ADDRESS,
            actionTargetSelector: toFunctionSelector(
              getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
            ),
            actionPolicies: [getSudoPolicy()]
          }
        ]
      }
    ])
  })

  test("use a permission", async () => {
    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashOne = await smartSessionsClient.usePermission({
      sessionDetailsArray: sessionDetails,
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          )
        }
      ],
      mode: "ENABLE_AND_USE"
    })
    const receiptOne = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHashOne
    })
    if (!receiptOne.success) {
      throw new Error("Smart sessions module validation failed")
    }
  })

  test("use a second permission on the same chain should work with index", async () => {
    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    // with index, it would use the second permission
    // which allows 0x871cc9d4
    const userOpHashWithIndex = await smartSessionsClient.usePermission({
      sessionDetailsArray: sessionDetails,
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
          )
        }
      ],
      mode: "ENABLE_AND_USE",
      indexWithinChain: 1 // starts from 0
    })
    const receiptWithIndex = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHashWithIndex
    })
    expect(receiptWithIndex.success).toBe(true)
  })

  test("use a permission a second time", async () => {
    const emulatedAccount = await toNexusAccount({
      accountAddress: nexusAccount.address,
      signer: redeemerAccount,
      chainConfiguration: {
        chain,
        transport: http(infra.network.rpcUrl),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    })

    const emulatedClient = createSmartAccountClient({
      account: emulatedAccount,
      transport: http(bundlerUrl),
      mock: true
    })

    const smartSessionsClient = emulatedClient.extend(smartSessionActions())

    const userOpHashTwo = await smartSessionsClient.usePermission({
      sessionDetailsArray: sessionDetails,
      calls: [
        {
          to: COUNTER_ADDRESS,
          data: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          )
        }
      ],
      mode: "USE"
    })

    const receiptTwo = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHashTwo
    })
    expect(receiptTwo.success).toBe(true)
  })
})
