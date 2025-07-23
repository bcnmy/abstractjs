import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  createPublicClient,
  createWalletClient,
  isAddress,
  isHex,
  zeroAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, baseSepolia, optimism, polygon, spicy } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../test/testSetup"
import {
  type NetworkConfig,
  getBalance,
  transferErc20
} from "../../test/testUtils"
import { createMeeClient } from "../clients/createMeeClient"
import { MEE_VALIDATOR_ADDRESS, NEXUS_VERSION_LATEST } from "../constants"
import { mcUSDC, testnetMcUSDC } from "../constants/tokens"
import { toMeeK1Module } from "../modules"
import { getNexus } from "../modules/utils/Helpers"
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
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount
    })
  })

  test("should create multichain account with correct parameters", async () => {
    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport]
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
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
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
  describe("nexusVersion", () => {
    test("should throw an error if the version is supported but not by the chain", async () => {
      const notCancunChain = polygon
      await expect(
        toNexusAccount({
          chain: notCancunChain,
          signer: eoaAccount,
          transport: http(TESTNET_RPC_URLS[notCancunChain.id]),
          options: {
            version: getNexus("1.2.0")
          }
        })
      ).rejects.toThrow()
    })
    test("should auto switch to 1.0.x if the version is not specified and the chain needs it", async () => {
      const notCancunChain = polygon
      const nacc = await toNexusAccount({
        chain: notCancunChain,
        signer: eoaAccount,
        transport: http(TESTNET_RPC_URLS[notCancunChain.id])
      })
      expect(nacc.accountId.includes("1.0.")).toBeTruthy()
    })
    test("should create an account with the correct nexus version", async () => {
      const nexusAccount = await toMultichainNexusAccount({
        signer: eoaAccount,
        chains: [baseSepolia, base, optimism],
        transports: [
          http(TESTNET_RPC_URLS[baseSepolia.id]),
          http(TESTNET_RPC_URLS[base.id]),
          http(TESTNET_RPC_URLS[optimism.id])
        ],
        options: [
          { version: getNexus("1.0.2") },
          { version: getNexus(NEXUS_VERSION_LATEST) }
        ],
        validators: [
          toMeeK1Module({ signer: eoaAccount, module: MEE_VALIDATOR_ADDRESS })
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
        `biconomy.nexus.${NEXUS_VERSION_LATEST}`
      )
      expect(nexusAccount.deploymentOn(optimism.id)?.accountId).toEqual(
        `biconomy.nexus.${NEXUS_VERSION_LATEST}`
      )
    })

    test.skip("should work with a different set of contracts", async () => {
      const newSigner = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`)
      const nexusAccount = await toMultichainNexusAccount({
        signer: newSigner,
        chains: [baseSepolia],
        transports: [http(TESTNET_RPC_URLS[baseSepolia.id])],
        options: [
          // {
          //   version: {
          //     version: "1.0.2",
          //     accountId: "biconomy.nexus.1.0.2",
          //     factoryAddress: "0xEA774bb5A2217391E0E5f9828b68C21E9176F22c",
          //     bootStrapAddress: "0xB8aab0c542190daA7546b0ea48B7C8613c0A7454",
          //     implementationAddress:
          //       "0x7Ab43d55D4Eaee1e08aD31aE3A3BF6cFA2c3e88A",
          //     k1ValidatorAddress: "0xe54dd54Af28D0eAEf37C6Ad413CeD4513B9C0B88",
          //     k1FactoryAddress: "0xd5562630CBeAc845D794e684c181E39a096cFe23"
          //   }
          // },
          { version: getNexus("1.0.2") }
        ]
      })
      const meeClient = await createMeeClient({
        account: nexusAccount
      })

      const quote = await meeClient.getQuote({
        instructions: [
          mcNexus.build({
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
          address: testnetMcUSDC.addressOn(baseSepolia.id),
          chainId: baseSepolia.id
        }
      })

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(TESTNET_RPC_URLS[baseSepolia.id])
      })
      let balance = await getBalance(
        publicClient,
        nexusAccount.deploymentOn(baseSepolia.id)!.address,
        testnetMcUSDC.addressOn(baseSepolia.id)
      )
      // transfer usdc to nexus account
      const buffer = 1000n
      if (balance < BigInt(quote.paymentInfo.tokenWeiAmount) + buffer) {
        const walletClient = createWalletClient({
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          account: newSigner
        })
        await transferErc20({
          // @ts-ignore
          publicClient,
          walletClient,
          tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
          recipient: nexusAccount.deploymentOn(baseSepolia.id)!.address,
          amount: BigInt(quote.paymentInfo.tokenWeiAmount) + buffer
        })
        balance = await getBalance(
          publicClient,
          nexusAccount.deploymentOn(baseSepolia.id)!.address,
          testnetMcUSDC.addressOn(baseSepolia.id)
        )
      }
      console.log(
        { balance },
        quote.paymentInfo,
        nexusAccount.deploymentOn(baseSepolia.id)!.address
      )
      // transfer chz to nexus account
      // const chzWalletClient = createWalletClient({
      //   chain: spicy,
      //   transport: http(),
      //   account: newSigner
      // })
      // const chzPublicClient = createPublicClient({
      //   chain: spicy,
      //   transport: http()
      // })
      // const chzTx = await chzWalletClient.sendTransaction({
      //   to: nexusAccount.deploymentOn(spicy.id)!.address,
      //   value: 3n
      // })
      // const chzReceipt = await chzPublicClient.waitForTransactionReceipt({
      //   hash: chzTx,
      //   confirmations: TEST_BLOCK_CONFIRMATIONS
      // })

      // console.log(chzReceipt)
      // console.log({ balance })
      const { hash } = await meeClient.executeQuote({
        quote
      })
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      console.log(receipt)
      expect(receipt.transactionStatus).toEqual("MINED_SUCCESS")
    })
  })
})
