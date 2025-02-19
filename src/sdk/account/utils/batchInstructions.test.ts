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
  type MultichainSmartAccount,
  buildApprove,
  buildTransferFrom,
  toMultichainNexusAccount
} from ".."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { mcUSDC } from "../../constants/tokens"
import { batchInstructions } from "./batchInstructions"

const createBaseApproval = (account: MultichainSmartAccount, amount: string) =>
  buildApprove(
    { account },
    {
      chainId: base.id,
      tokenAddress: mcUSDC.addressOn(base.id),
      spender: account.addressOn(base.id, true),
      amount: parseEther(amount)
    }
  )

const createOptimismApproval = (
  account: MultichainSmartAccount,
  amount: string
) =>
  buildApprove(
    { account },
    {
      chainId: optimism.id,
      tokenAddress: mcUSDC.addressOn(optimism.id),
      spender: account.addressOn(optimism.id, true),
      amount: parseEther(amount)
    }
  )

const createMainnetApproval = (
  account: MultichainSmartAccount,
  amount: string
) =>
  buildApprove(
    { account },
    {
      chainId: mainnet.id,
      tokenAddress: mcUSDC.addressOn(mainnet.id),
      spender: account.addressOn(mainnet.id, true),
      amount: parseEther(amount)
    }
  )

const createBaseTriggerCall = (
  account: MultichainSmartAccount,
  sender: string
) =>
  buildTransferFrom(
    { account },
    {
      chainId: base.id,
      tokenAddress: mcUSDC.addressOn(base.id),
      amount: 100n,
      recipient: account.addressOn(base.id, true),
      sender: zeroAddress
    }
  )

describe("utils.batchInstructions", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain, mainnet],
      transports: [...transports, http()],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should batch consecutive instructions on the same chain", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0"),
      createBaseApproval(mcNexus, "2.0")
    ]

    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      account: mcNexus,
      triggerCall,
      instructions
    })

    expect(result).toHaveLength(1) // All instructions should be batched
    expect(result[0].chainId).toBe(base.id)
  })

  test("should not batch instructions across different chains", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0"),
      createOptimismApproval(mcNexus, "1.0")
    ]

    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      account: mcNexus,
      triggerCall,
      instructions
    })

    expect(result).toHaveLength(2)
    expect(result[0].chainId).toBe(base.id)
    expect(result[1].chainId).toBe(optimism.id)
  })

  test("should batch multiple groups of consecutive same-chain instructions", async () => {
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

    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      account: mcNexus,
      triggerCall,
      instructions
    })

    expect(result).toHaveLength(3) // Should have 3 groups: base batch, optimism, base batch
    expect(result[0].chainId).toBe(base.id)
    expect(result[1].chainId).toBe(optimism.id)
    expect(result[2].chainId).toBe(base.id)
  })

  test("should handle single instructions correctly", async () => {
    const instructions = [
      createBaseApproval(mcNexus, "1.0"),
      createOptimismApproval(mcNexus, "1.0"),
      createMainnetApproval(mcNexus, "1.0")
    ]

    const triggerCall = await createBaseTriggerCall(mcNexus, eoaAccount.address)

    const result = await batchInstructions({
      account: mcNexus,
      triggerCall,
      instructions
    })

    expect(result).toHaveLength(3) // Should have 3 separate instructions
    expect(result[0].chainId).toBe(base.id)
    expect(result[1].chainId).toBe(optimism.id)
    expect(result[2].chainId).toBe(mainnet.id)
  })
})
