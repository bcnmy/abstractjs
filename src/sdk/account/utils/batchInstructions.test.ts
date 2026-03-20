import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  parseEther,
  zeroAddress
} from "viem"
import { base, mainnet, optimism } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  type MeeVersionsWithChainId,
  type MultichainSmartAccount,
  buildApprove,
  buildTransferFrom,
  resolveInstructions,
  toMultichainNexusAccount
} from ".."
import {
  MAINNET_RPC_URLS,
  getTestChainConfig,
  toNetwork
} from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import type { Overrides } from "../../clients/decorators/mee"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { mcUSDC } from "../../constants/tokens"
import { getMEEVersion } from "../../modules"
import { batchInstructions } from "./batchInstructions"

describe("utils.batchInstructions", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport
  let meeVersions: MeeVersionsWithChainId

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: mainnet,
          transport: http(MAINNET_RPC_URLS[mainnet.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeVersions = mcNexus.deployments.map(({ version, chain }) => ({
      chainId: chain.id,
      version
    }))

    meeClient = await createMeeClient({ account: mcNexus })
  })

  const createBaseApproval = (
    account: MultichainSmartAccount,
    amount: string,
    lowerBoundTimestamp?: number,
    upperBoundTimestamp?: number,
    executionSimulationRetryDelay?: number,
    simulationOverrides?: Overrides
  ) =>
    buildApprove(
      { accountAddress: account.signer.address, meeVersions },
      {
        chainId: base.id,
        tokenAddress: mcUSDC.addressOn(base.id),
        spender: account.addressOn(base.id, true),
        amount: parseEther(amount),
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay,
        simulationOverrides
      }
    )

  const createOptimismApproval = (
    account: MultichainSmartAccount,
    amount: string,
    lowerBoundTimestamp?: number,
    upperBoundTimestamp?: number,
    executionSimulationRetryDelay?: number,
    simulationOverrides?: Overrides
  ) =>
    buildApprove(
      { accountAddress: account.signer.address, meeVersions },
      {
        chainId: optimism.id,
        tokenAddress: mcUSDC.addressOn(optimism.id),
        spender: account.addressOn(optimism.id, true),
        amount: parseEther(amount),
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay,
        simulationOverrides
      }
    )

  const createMainnetApproval = (
    account: MultichainSmartAccount,
    amount: string,
    lowerBoundTimestamp?: number,
    upperBoundTimestamp?: number,
    executionSimulationRetryDelay?: number,
    simulationOverrides?: Overrides
  ) =>
    buildApprove(
      { accountAddress: account.signer.address, meeVersions },
      {
        chainId: mainnet.id,
        tokenAddress: mcUSDC.addressOn(mainnet.id),
        spender: account.addressOn(mainnet.id, true),
        amount: parseEther(amount),
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay,
        simulationOverrides
      }
    )

  const createBaseTriggerCall = (
    account: MultichainSmartAccount,
    sender: string
  ) =>
    buildTransferFrom(
      { accountAddress: account.signer.address, meeVersions },
      {
        chainId: base.id,
        tokenAddress: mcUSDC.addressOn(base.id),
        amount: 100n,
        recipient: account.addressOn(base.id, true),
        sender: zeroAddress
      }
    )

  test("should batch instructions on the same chain", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0"),
      createBaseApproval(mcNexus, "2.0")
    ]

    const resolvedInstructions = await resolveInstructions(instructions)
    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: [...triggerCall, ...resolvedInstructions]
    })

    expect(result).toHaveLength(1) // All instructions should be batched
    expect(result[0].chainId).toBe(base.id)
  })

  test("should not batch instructions across different chains", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0"),
      createOptimismApproval(mcNexus, "1.0")
    ]

    const resolvedInstructions = await resolveInstructions(instructions)
    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: [...triggerCall, ...resolvedInstructions]
    })

    expect(result).toHaveLength(2)
    expect(result[0].chainId).toBe(base.id)
    expect(result[1].chainId).toBe(optimism.id)
  })

  test("should batch multiple same chain instructions into groups per chain", async () => {
    const instructions = [
      // First base chain group
      createBaseApproval(mcNexus, "1.0"),
      createBaseApproval(mcNexus, "2.0"),
      // Optimism instruction
      createOptimismApproval(mcNexus, "1.0"),
      // Second base chain group
      createBaseApproval(mcNexus, "3.0"),
      createBaseApproval(mcNexus, "4.0")
    ]

    const resolvedInstructions = await resolveInstructions(instructions)
    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: [...triggerCall, ...resolvedInstructions]
    })

    expect(result).toHaveLength(2)
    expect(result[0].chainId).toBe(base.id)
    expect(result[1].chainId).toBe(optimism.id)
  })

  test("should handle single instructions correctly", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0"),
      createOptimismApproval(mcNexus, "1.0"),
      createMainnetApproval(mcNexus, "1.0")
    ]

    const resolvedInstructions = await resolveInstructions(instructions)
    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: [...triggerCall, ...resolvedInstructions]
    })

    expect(result).toHaveLength(3) // Should have 3 separate instructions
    expect(result[0].chainId).toBe(base.id)
    expect(result[1].chainId).toBe(optimism.id)
    expect(result[2].chainId).toBe(mainnet.id)
  })

  test("Should use instruction level timestamps", async () => {
    const lowerBoundTimestamp = Math.floor(Date.now() / 1000)
    const upperBoundTimestamp = lowerBoundTimestamp + 300 // 5 mins

    const instructions = [
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp + 60,
        upperBoundTimestamp + 60
      ),
      createOptimismApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp + 70,
        upperBoundTimestamp + 70
      ),
      createMainnetApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp + 80,
        upperBoundTimestamp + 80
      )
    ]

    const resolvedInstructions = await resolveInstructions(instructions)

    expect(resolvedInstructions[0].lowerBoundTimestamp).to.eq(
      lowerBoundTimestamp
    )
    expect(resolvedInstructions[0].upperBoundTimestamp).to.eq(
      upperBoundTimestamp
    )

    expect(resolvedInstructions[1].lowerBoundTimestamp).to.eq(
      lowerBoundTimestamp + 60
    )
    expect(resolvedInstructions[1].upperBoundTimestamp).to.eq(
      upperBoundTimestamp + 60
    )

    expect(resolvedInstructions[2].lowerBoundTimestamp).to.eq(
      lowerBoundTimestamp + 70
    )
    expect(resolvedInstructions[2].upperBoundTimestamp).to.eq(
      upperBoundTimestamp + 70
    )

    expect(resolvedInstructions[3].lowerBoundTimestamp).to.eq(
      lowerBoundTimestamp + 80
    )
    expect(resolvedInstructions[3].upperBoundTimestamp).to.eq(
      upperBoundTimestamp + 80
    )
  })

  test("Should use highest instruction level timestamps of batched instruction", async () => {
    const lowerBoundTimestamp = Math.floor(Date.now() / 1000)
    const upperBoundTimestamp = lowerBoundTimestamp + 300 // 5 mins

    const highestUpperBoundTimestamp = upperBoundTimestamp + 300 // total 10 mins

    const instructions = [
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        highestUpperBoundTimestamp
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp
      )
    ]

    const resolvedInstructions = await resolveInstructions(instructions)

    const batchedInstructions = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: resolvedInstructions
    })

    expect(batchedInstructions[0].lowerBoundTimestamp).to.eq(
      lowerBoundTimestamp
    )
    expect(batchedInstructions[0].upperBoundTimestamp).to.eq(
      highestUpperBoundTimestamp
    )
  })

  test("Should use the last timestamps if there are multiple same duration timestamps", async () => {
    const lowerBoundTimestamp = Math.floor(Date.now() / 1000)
    const upperBoundTimestamp = lowerBoundTimestamp + 300 // 5 mins

    const instructions = [
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp + 120,
        upperBoundTimestamp + 120
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp + 180,
        upperBoundTimestamp + 180
      )
    ]

    const resolvedInstructions = await resolveInstructions(instructions)

    const batchedInstructions = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: resolvedInstructions
    })

    expect(batchedInstructions[0].lowerBoundTimestamp).to.eq(
      lowerBoundTimestamp + 180
    )
    expect(batchedInstructions[0].upperBoundTimestamp).to.eq(
      upperBoundTimestamp + 180
    )
  })

  test("Should use instruction level executionSimulationRetryDelay", async () => {
    const lowerBoundTimestamp = Math.floor(Date.now() / 1000)
    const upperBoundTimestamp = lowerBoundTimestamp + 300 // 5 mins
    const executionSimulationRetryDelay = 1 * 60 * 1000 // 1 minute

    const instructions = [
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay + 1000
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp
      )
    ]

    const resolvedInstructions = await resolveInstructions(instructions)

    expect(resolvedInstructions[0].executionSimulationRetryDelay).to.eq(
      executionSimulationRetryDelay
    )
    expect(resolvedInstructions[1].executionSimulationRetryDelay).to.eq(
      executionSimulationRetryDelay + 1000
    )
    expect(resolvedInstructions[2].executionSimulationRetryDelay).to.eq(
      undefined
    )
  })

  test("Should use instruction level largest executionSimulationRetryDelay if batched", async () => {
    const lowerBoundTimestamp = Math.floor(Date.now() / 1000)
    const upperBoundTimestamp = lowerBoundTimestamp + 300 // 5 mins
    const executionSimulationRetryDelay = 1 * 60 * 1000 // 1 minute

    const instructions = [
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay
      ),
      createBaseApproval(
        mcNexus,
        "1.0",
        lowerBoundTimestamp,
        upperBoundTimestamp,
        executionSimulationRetryDelay + 1000
      )
    ]

    const resolvedInstructions = await resolveInstructions(instructions)

    const batchedInstructions = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: resolvedInstructions
    })

    expect(batchedInstructions[0].executionSimulationRetryDelay).to.eq(
      executionSimulationRetryDelay + 1000
    )
  })

  test("Should simulationOverrides applied on instruction level", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0", undefined, undefined, undefined, {
        tokenOverrides: [
          {
            tokenAddress: zeroAddress,
            chainId: 84532,
            balance: 1n,
            accountAddress: zeroAddress
          }
        ],
        customOverrides: [
          {
            contractAddress: zeroAddress,
            chainId: 84532,
            storageSlot: "0x",
            value: "0x"
          }
        ]
      }),
      createBaseApproval(mcNexus, "1.0", undefined, undefined, undefined, {
        tokenOverrides: [
          {
            tokenAddress: zeroAddress,
            chainId: 84532,
            balance: 1n,
            accountAddress: zeroAddress
          }
        ],
        customOverrides: [
          {
            contractAddress: zeroAddress,
            chainId: 84532,
            storageSlot: "0x",
            value: "0x"
          }
        ]
      })
    ]

    const resolvedInstructions = await resolveInstructions(instructions)

    expect(resolvedInstructions.length).to.be.eq(2)

    expect(resolvedInstructions[0].simulationOverrides).toBeDefined()
    expect(
      resolvedInstructions[0].simulationOverrides?.tokenOverrides
    ).toBeDefined()
    expect(
      resolvedInstructions[0].simulationOverrides?.customOverrides
    ).toBeDefined()
    expect(
      resolvedInstructions[0].simulationOverrides?.tokenOverrides?.length
    ).to.be.eq(1)
    expect(
      resolvedInstructions[0].simulationOverrides?.customOverrides?.length
    ).to.be.eq(1)

    expect(resolvedInstructions[1].simulationOverrides).toBeDefined()
    expect(
      resolvedInstructions[1].simulationOverrides?.tokenOverrides
    ).toBeDefined()
    expect(
      resolvedInstructions[1].simulationOverrides?.customOverrides
    ).toBeDefined()
    expect(
      resolvedInstructions[1].simulationOverrides?.tokenOverrides?.length
    ).to.be.eq(1)
    expect(
      resolvedInstructions[1].simulationOverrides?.customOverrides?.length
    ).to.be.eq(1)

    const batchedInstructions = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: resolvedInstructions
    })

    expect(batchedInstructions.length).to.be.eq(1)
    expect(batchedInstructions[0].simulationOverrides).toBeDefined()
    expect(
      batchedInstructions[0].simulationOverrides?.tokenOverrides
    ).toBeDefined()
    expect(
      batchedInstructions[0].simulationOverrides?.customOverrides
    ).toBeDefined()
    expect(
      batchedInstructions[0].simulationOverrides?.tokenOverrides?.length
    ).to.be.eq(2)
    expect(
      batchedInstructions[0].simulationOverrides?.customOverrides?.length
    ).to.be.eq(2)
  })

  test("Should batching resolves the highest retry count", async () => {
    const transferOne = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId: base.id,
        tokenAddress: mcUSDC.addressOn(base.id),
        amount: 100n,
        recipient: mcNexus.addressOn(base.id, true),
        retry: 1
      }
    })

    const transferTwo = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId: base.id,
        tokenAddress: mcUSDC.addressOn(base.id),
        amount: 100n,
        recipient: mcNexus.addressOn(base.id, true),
        retry: 4
      }
    })

    const transferThree = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId: base.id,
        tokenAddress: mcUSDC.addressOn(base.id),
        amount: 100n,
        recipient: mcNexus.addressOn(base.id, true),
        retry: 2
      }
    })

    const batchedInstructions = await batchInstructions({
      accountAddress: mcNexus.signer.address,
      meeVersions,
      instructions: [...transferOne, ...transferTwo, ...transferThree]
    })

    expect(batchedInstructions[0].retry).to.eq(4)
  })
})
