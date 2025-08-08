import {
  http,
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
import type { FeeTokenInfo } from "../../../clients/decorators/mee/getQuote"
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

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]
  let decimals: number
  let pubClient: PublicClient
  let pubClientTarget: PublicClient

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    pubClient = createPublicClient({
      chain: paymentChain,
      transport: transports[0]
    })

    decimals = await pubClient.readContract({
      address: feeToken.address,
      abi: erc20Abi,
      functionName: "decimals"
    })

    pubClientTarget = createPublicClient({
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
      account: mcNexus,
      apiKey: process.env.PERSONAL_MEE_API_KEY
    })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test.runIf(runPaidTests)(
    "should build and execute an across intent composable userOp",
    async () => {
      const orchOnTargetBalanceBefore = await pubClientTarget.readContract({
        address: mcUSDC.addressOn(base.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(base.id)!]
      })

      const actualInputAmount = parseUnits("0.5", decimals)
      const benchmarkInputAmount = parseUnits("2", decimals)

      const trigger: Trigger = {
        chainId: optimism.id,
        tokenAddress: mcUSDC.addressOn(optimism.id),
        amount: actualInputAmount
      }

      const callAcrossInstructions = await mcNexus.buildComposable({
        type: "acrossIntent",
        data: {
          depositor: mcNexus.addressOn(optimism.id)!,
          recipient: mcNexus.addressOn(base.id)!,
          inputToken: mcUSDC.addressOn(optimism.id),
          outputToken: mcUSDC.addressOn(base.id),
          inputAmountRuntimeParams: {
            targetAddress: mcNexus.addressOn(optimism.id)!,
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
        instructions: callAcrossInstructions,
        feeToken
      })

      const { hash } = await meeClient.executeFusionQuote({ fusionQuote })

      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      const orchOnPaymentBalanceAfter = await pubClient.readContract({
        address: mcUSDC.addressOn(optimism.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(optimism.id)!]
      })

      expect(orchOnPaymentBalanceAfter).toEqual(0n)

      const orchOnTargetBalanceAfter = await pubClientTarget.readContract({
        address: mcUSDC.addressOn(base.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [mcNexus.addressOn(base.id)!]
      })

      // expect the balance to be balance before + actual input amount - fees and fees are not more than 30%
      expect(orchOnTargetBalanceAfter).toBeGreaterThanOrEqual(
        orchOnTargetBalanceBefore + (actualInputAmount * 3n) / 10n
      )
    }
  )
})
