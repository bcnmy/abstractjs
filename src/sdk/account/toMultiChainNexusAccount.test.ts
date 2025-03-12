import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  isAddress,
  isHex
} from "viem"
import { base, baseSepolia, optimism } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../test/testSetup"
import type { NetworkConfig } from "../../test/testUtils"
import {
  BICONOMY_ATTESTER_ADDRESS,
  MEE_VALIDATOR_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS
} from "../constants"
import { NEXUS_ACCOUNT_FACTORY } from "../constants"
import { mcUSDC } from "../constants/tokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "./toMultiChainNexusAccount"
import { toNexusAccount } from "./toNexusAccount"

describe("mee.toMultiChainNexusAccount", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })
  })

  test("should create multichain account with correct parameters", async () => {
    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chains: [paymentChain, targetChain],
      transports
    })

    // Verify the structure of the returned object
    expect(mcNexus).toHaveProperty("deployments")
    expect(mcNexus).toHaveProperty("signer")
    expect(mcNexus).toHaveProperty("deploymentOn")
    expect(mcNexus.signer).toBe(eoaAccount)
    expect(mcNexus.deployments).toHaveLength(2)
  })

  test("should return correct deployment for specific chain", async () => {
    const deployment = mcNexus.deploymentOn(base.id)
    expect(deployment).toBeDefined()
    expect(deployment?.client?.chain?.id).toBe(base.id)
  })

  test("should handle empty chains array", async () => {
    await expect(
      toMultichainNexusAccount({
        signer: eoaAccount,
        chains: [],
        transports: []
      })
    ).rejects.toThrow("No chains provided")
  })

  test("should have configured accounts correctly", async () => {
    expect(mcNexus.deployments.length).toEqual(2)
  })

  test("should sign message using MEE Compliant Nexus Account", async () => {
    const nexus = await toNexusAccount({
      chain: baseSepolia,
      signer: eoaAccount,
      transport: http(),
      useK1Config: false,
      validatorAddress: MEE_VALIDATOR_ADDRESS,
      factoryAddress: NEXUS_ACCOUNT_FACTORY,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS]
    })

    expect(isAddress(nexus.address)).toBeTruthy()

    const signed = await nexus.signMessage({ message: { raw: "0xABC" } })
    expect(isHex(signed)).toBeTruthy()
  })

  test("should read usdc balance on mainnet", async () => {
    const readAddress = mcNexus.deploymentOn(optimism.id)?.address
    if (!readAddress) {
      throw new Error("No address found for optimism")
    }
    const usdcBalanceOnChains = await mcUSDC.read({
      account: mcNexus,
      functionName: "balanceOf",
      args: [readAddress],
      onChains: [base, optimism]
    })

    expect(usdcBalanceOnChains.length).toEqual(2)
  })

  test("mcNexus to have decorators successfully applied", async () => {
    expect(mcNexus.getUnifiedERC20Balance).toBeInstanceOf(Function)
    expect(mcNexus.build).toBeInstanceOf(Function)
    expect(mcNexus.buildBridgeInstructions).toBeInstanceOf(Function)
    expect(mcNexus.queryBridge).toBeDefined()
  })

  test("should check unified balance", async () => {
    const unifiedBalance = await mcNexus.getUnifiedERC20Balance(mcUSDC)
    expect(unifiedBalance).toHaveProperty("mcToken")
    expect(unifiedBalance).toHaveProperty("breakdown")
    expect(unifiedBalance.mcToken).toHaveProperty("deployments")
  })

  test("should query bridge", async () => {
    const unifiedBalance = await mcNexus.getUnifiedERC20Balance(mcUSDC)

    const tokenMapping = {
      on: (chainId: number) =>
        unifiedBalance.mcToken.deployments.get(chainId) || "0x",
      deployments: Array.from(
        unifiedBalance.mcToken.deployments.entries(),
        ([chainId, address]) => ({ chainId, address })
      )
    }

    const payload = await mcNexus.queryBridge({
      amount: 1000000n,
      toChain: base,
      fromChain: optimism,
      tokenMapping,
      account: mcNexus
    })

    expect(payload?.amount).toBeGreaterThan(0n)
    expect(payload?.receivedAtDestination).toBeGreaterThan(0n)
  })

  test("should test type safety of deploymentOn", async () => {
    const deployment = mcNexus.deploymentOn(base.id, true)
    expect(deployment).toBeDefined()
    expect(() => mcNexus.deploymentOn(baseSepolia.id, true)).toThrowError()
  })
})
