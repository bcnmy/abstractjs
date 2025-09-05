import {
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  type Transport,
  createPublicClient,
  erc20Abi,
  parseUnits,
  zeroAddress
} from "viem"
import { base } from "viem/chains"
import { optimism } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { Trigger } from "../../../clients/decorators/mee/signPermitQuote"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import type { MultichainSmartAccount } from "../../toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../toMultiChainNexusAccount"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.buildAcrossIntentComposable", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]
  let pubClientOp: PublicClient
  let pubClientBase: PublicClient

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!

    pubClientOp = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    pubClientBase = createPublicClient({
      chain: targetChain,
      transport: transports[1]
    })

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: transports[0],
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: transports[1],
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test.runIf(runPaidTests)(
    "should build and execute an across intent composable userOp (optimism to base)",
    async () => {
      const orchOnTargetBalanceBefore = await pubClientBase.readContract({
        address: mcUSDC.addressOn(base.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(base.id, true)]
      })

      // No need to deposit 0.5 now, because the nexus will always assumed to have fund. But here we are testing along with fusion mode as well
      const actualInputAmount = 1n
      const benchmarkInputAmount = parseUnits("2", 6) // USDC 6 decimals

      const trigger: Trigger = {
        chainId: optimism.id,
        tokenAddress: mcUSDC.addressOn(optimism.id),
        amount: actualInputAmount
      }

      const optimismToBaseAcrossCall = await mcNexus.buildComposable({
        type: "acrossIntent",
        data: {
          depositor: mcNexus.addressOn(optimism.id, true),
          recipient: mcNexus.addressOn(base.id, true),
          inputToken: mcUSDC.addressOn(optimism.id),
          outputToken: mcUSDC.addressOn(base.id),
          inputAmountRuntimeParams: {
            targetAddress: mcNexus.addressOn(optimism.id, true),
            tokenAddress: mcUSDC.addressOn(optimism.id),
            constraints: []
          },
          approximateExpectedInputAmount: benchmarkInputAmount,
          originChainId: optimism.id,
          destinationChainId: base.id,
          message: "0x",
          relayerAddress: zeroAddress
        }
      })

      const fusionQuote = await meeClient.getFusionQuote({
        trigger,
        instructions: [...optimismToBaseAcrossCall],
        feeToken: {
          address: mcUSDC.addressOn(optimism.id),
          chainId: optimism.id
        }
      })

      const { hash } = await meeClient.executeFusionQuote({ fusionQuote })

      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      console.log(receipt.explorerLinks)

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      const orchOnPaymentBalanceAfter = await pubClientOp.readContract({
        address: mcUSDC.addressOn(optimism.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(optimism.id, true)]
      })

      expect(orchOnPaymentBalanceAfter).toEqual(0n)

      const orchOnTargetBalanceAfter = await pubClientBase.readContract({
        address: mcUSDC.addressOn(base.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(base.id, true)]
      })

      // expect the balance to be balance before + actual input amount - fees and fees are not more than 30%
      expect(orchOnTargetBalanceAfter).toBeGreaterThanOrEqual(
        orchOnTargetBalanceBefore + (actualInputAmount * 3n) / 10n
      )
    }
  )

  test.runIf(runPaidTests)(
    "should build and execute an across intent composable userOp (base to optimism)",
    async () => {
      const benchmarkInputAmount = parseUnits("2", 6) // USDC 6 decimals

      const baseToOptimismAcrossCall = await mcNexus.buildComposable({
        type: "acrossIntent",
        data: {
          depositor: mcNexus.addressOn(base.id, true),
          recipient: mcNexus.addressOn(optimism.id, true),
          inputToken: mcUSDC.addressOn(base.id),
          outputToken: mcUSDC.addressOn(optimism.id),
          inputAmountRuntimeParams: {
            targetAddress: mcNexus.addressOn(base.id, true),
            tokenAddress: mcUSDC.addressOn(base.id),
            constraints: []
          },
          approximateExpectedInputAmount: benchmarkInputAmount,
          originChainId: base.id,
          destinationChainId: optimism.id,
          message: "0x",
          relayerAddress: zeroAddress
        }
      })

      const quote = await meeClient.getQuote({
        instructions: [...baseToOptimismAcrossCall],
        feeToken: {
          address: mcUSDC.addressOn(base.id),
          chainId: base.id
        }
      })

      const { hash } = await meeClient.executeQuote({ quote })

      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      console.log(receipt.explorerLinks)

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      const orchOnPaymentBalanceAfter = await pubClientBase.readContract({
        address: mcUSDC.addressOn(base.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(base.id, true)]
      })

      expect(orchOnPaymentBalanceAfter).toEqual(0n)
    }
  )
})
