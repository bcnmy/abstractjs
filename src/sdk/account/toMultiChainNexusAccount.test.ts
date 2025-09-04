import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  isAddress,
  isHex,
  zeroAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia, chiliz, optimism } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  MAINNET_RPC_URLS,
  TESTNET_RPC_URLS,
  getTestChainConfig,
  toNetwork
} from "../../test/testSetup"
import { testnetMcTestUSDCP } from "../../test/testTokens"
import type { NetworkConfig } from "../../test/testUtils"
import { createMeeClient } from "../clients/createMeeClient"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../constants"
import { mcUSDC } from "../constants/tokens"
import { getMEEVersion } from "../modules/utils/getMeeConfig"
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
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

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
        }
      ]
    })
  })

  test("should create multichain account with correct parameters", async () => {
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
        }
      ]
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
        chainConfigurations: []
      })
    ).rejects.toThrow("No chain configuration provided")
  })

  test("should have configured accounts correctly", async () => {
    expect(mcNexus.deployments.length).toEqual(2)
  })

  test("should sign message using MEE Compliant Nexus Account", async () => {
    const nexus = await toNexusAccount({
      signer: eoaAccount,
      chainConfiguration: {
        chain: baseSepolia,
        transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
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
      depositor: mcNexus.addressOn(optimism.id, true),
      recipient: mcNexus.addressOn(base.id, true),
      amount: 1000000n,
      toChainId: base.id,
      fromChainId: optimism.id,
      tokenMapping
    })

    expect(payload?.amount).toBeGreaterThan(0n)
    expect(payload?.receivedAtDestination).toBeGreaterThan(0n)
  })

  test("should test type safety of deploymentOn", async () => {
    const deployment = mcNexus.deploymentOn(base.id, true)
    expect(deployment).toBeDefined()
    expect(() => mcNexus.deploymentOn(baseSepolia.id, true)).toThrowError()
  })
  describe("nexusVersion", () => {
    test("should throw an error if the version is not supported or deployed for the chain", async () => {
      await expect(
        toNexusAccount({
          signer: eoaAccount,
          chainConfiguration: {
            chain: base,
            transport: http(MAINNET_RPC_URLS[base.id]),
            version: {
              ...getMEEVersion(MEEVersion.V2_0_0),
              // Forcefully override this address, so it doesn't have any byte code.
              // This indirectly tests the MEE version contract unavailability for brand new chains
              implementationAddress:
                "0x0000000000000000000000000000000000000001"
            }
          }
        })
      ).rejects.toThrow()
    })
    test("should throw an error if the version is supported but not by the chain", async () => {
      const notCancunChain = chiliz
      await expect(
        toNexusAccount({
          signer: eoaAccount,
          chainConfiguration: {
            chain: notCancunChain,
            transport: http(MAINNET_RPC_URLS[notCancunChain.id]),
            version: getMEEVersion(MEEVersion.V2_0_0)
          }
        })
      ).rejects.toThrow(
        "MEE version (2.0.0) is not supported for the Chiliz Chain chain. Please use a version earlier than 2.0.0 or a chain that supports Cancun."
      )
    })
    test("should create an account with the correct nexus version", async () => {
      const nexusAccount = await toMultichainNexusAccount({
        signer: eoaAccount,
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(MEEVersion.V1_0_0)
          },
          {
            chain: base,
            transport: http(MAINNET_RPC_URLS[base.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          },
          {
            chain: optimism,
            transport: http(MAINNET_RPC_URLS[optimism.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })
      expect(nexusAccount.deployments.length).toEqual(3)
      expect(nexusAccount.deploymentOn(baseSepolia.id)?.address).not.toEqual(
        nexusAccount.deploymentOn(base.id)?.address
      )
      expect(
        nexusAccount.deploymentOn(baseSepolia.id)?.accountId.includes("1.0.")
      ).toEqual(true)
      expect(nexusAccount.deploymentOn(base.id)?.accountId).toEqual(
        "biconomy.nexus.1.2.0" // MEE 2.0.0 features Nexus 1.2.0
      )
      expect(nexusAccount.deploymentOn(optimism.id)?.accountId).toEqual(
        "biconomy.nexus.1.2.0" // 2.0.0 is 1.2.0
      )
    })

    describe("should work with different versions", async () => {
      const newSigner = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`)
      const executeTx = async (nexusAccount: MultichainSmartAccount) => {
        const meeClient = await createMeeClient({
          account: nexusAccount
        })
        const quote = await meeClient.getQuote({
          instructions: [
            nexusAccount.build({
              type: "default",
              data: {
                calls: [
                  {
                    to: zeroAddress,
                    value: 1n
                  }
                ],
                chainId: baseSepolia.id
              }
            })
          ],
          feeToken: {
            address: testnetMcTestUSDCP.addressOn(baseSepolia.id),
            chainId: baseSepolia.id
          }
        })
        const { hash } = await meeClient.executeQuote({
          quote
        })
        const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
        expect(receipt.transactionStatus).toEqual("MINED_SUCCESS")
      }
      test("works with mee version 1.0.0", async () => {
        const nexusAccount = await toMultichainNexusAccount({
          signer: newSigner,
          chainConfigurations: [
            {
              chain: baseSepolia,
              transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
              version: getMEEVersion(MEEVersion.V1_0_0)
            }
          ]
        })
        await executeTx(nexusAccount)
      })
      test("works with mee version 1.1.0", async () => {
        const nexusAccount = await toMultichainNexusAccount({
          signer: newSigner,
          chainConfigurations: [
            {
              chain: baseSepolia,
              transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
              version: getMEEVersion(MEEVersion.V1_1_0)
            }
          ]
        })
        await executeTx(nexusAccount)
      })
      test("works with mee version 2.0.0", async () => {
        const nexusAccount = await toMultichainNexusAccount({
          signer: newSigner,
          chainConfigurations: [
            {
              chain: baseSepolia,
              transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
              version: getMEEVersion(MEEVersion.V2_0_0)
            }
          ]
        })
        await executeTx(nexusAccount)
      })
      test("works with mee version 2.1.0", async () => {
        const nexusAccount = await toMultichainNexusAccount({
          signer: newSigner,
          chainConfigurations: [
            {
              chain: baseSepolia,
              transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
              version: getMEEVersion(MEEVersion.V2_1_0)
            }
          ]
        })
        await executeTx(nexusAccount)
      })
    })
  })

  test("should work with overrides", async () => {
    const nexusAccount = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: {
            ...getMEEVersion(MEEVersion.V2_0_0),
            factoryAddress: "0x0000006648ED9B2B842552BE63Af870bC74af837"
          }
        }
      ]
    })
    expect(nexusAccount.deployments[0].factoryAddress).toEqual(
      "0x0000006648ED9B2B842552BE63Af870bC74af837"
    )
  })
})
