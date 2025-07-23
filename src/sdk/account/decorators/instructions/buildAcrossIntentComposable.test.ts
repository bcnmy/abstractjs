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
  zeroAddress,
  readContract,
} from "viem"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {createChainAddressMap, runtimeERC20BalanceOf, greaterThanOrEqualTo} from "../../../modules"
import { getTestChainConfig, TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { type FeeTokenInfo } from "../../../clients/decorators/mee/getQuote"
import type { MultichainSmartAccount } from "../../toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import { base } from "viem/chains"
import { optimism } from "viem/chains"
import { Trigger } from "../../../clients/decorators/mee/signPermitQuote"
import type { ComposableCall } from "../../../modules/utils/composabilityCalls"

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
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: process.env.PERSONAL_MEE_API_KEY
    })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)

  })

  test.runIf(runPaidTests)("should build and execute an across intent composable userOp", async () => {
     
    // 🏦 AAVE Pool addresses
    const aavePoolAddresses = createChainAddressMap([
      [base.id, '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5'],
      [optimism.id, '0x794a61358D6845594F94dc1DB02A252b5b4814aD']
    ])
    
    // 💎 aUSDC (AAVE interest-bearing USDC)
    const aUSDCAddresses = createChainAddressMap([
      [base.id, '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB'],
      [optimism.id, '0x625E7708f30cA75bfd92586e17077590C60eb4cD']
    ])
    
    // 🚀 Across SpokePool addresses
    const acrossSpokePool = createChainAddressMap([
      [base.id, '0x09aea4b2242abc8bb4bb78d537a67a245a7bec64'],
      [optimism.id, '0x6f26Bf09B1C792e3228e5467807a900A503c0281']
    ])

    const orchOnTargetBalanceBefore = await pubClientTarget.readContract({
      address: mcUSDC.addressOn(base.id),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [mcNexus.addressOn(base.id)!]
    })

    const actualInputAmount = parseUnits("1", decimals)
    const benchmarkInputAmount = parseUnits("2", decimals)

    const trigger: Trigger = {
      chainId: optimism.id,
      tokenAddress: mcUSDC.addressOn(optimism.id),
      amount: actualInputAmount,
    }

    const callAcrossInstructions = await mcNexus.buildComposable({
      type: 'acrossIntent',
      data: {
        pool: acrossSpokePool[optimism.id],
        depositor: mcNexus.addressOn(optimism.id)!, // WOULD IT EVEN WORK? FUNDING USEROP/ACTION SHOULD BE THERE => NEED TO CHECK IT IN THE USEROP
        recipient: mcNexus.addressOn(base.id)!,
        inputToken: mcUSDC.addressOn(optimism.id),
        outputToken: mcUSDC.addressOn(base.id),
        approximateExpectedInputAmount: benchmarkInputAmount,
        originChainId: optimism.id,
        destinationChainId: base.id,
        message: '0x',
        relayerAddress: zeroAddress,
      }
    })

    const fusionQuote = await meeClient.getFusionQuote({
      trigger,
      instructions: callAcrossInstructions,
      feeToken
    })

    console.log(fusionQuote.quote.userOps[1]);
     
    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
    console.log(hash)

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
    expect(orchOnTargetBalanceAfter).toBeGreaterThanOrEqual(orchOnTargetBalanceBefore + (actualInputAmount * 3n) / 10n)

  })
})
