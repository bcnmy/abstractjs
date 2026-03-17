import {
  http,
  type Chain,
  type LocalAccount,
  parseUnits,
  zeroAddress
} from "viem"
import { optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, it, vi } from "vitest"
import { TESTNET_RPC_URLS, toNetwork } from "../../../test/testSetup"
import { testnetMcTestUSDC, testnetMcTestUSDCP } from "../../../test/testTokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { AavePoolAbi } from "../../constants/abi"
import { getMEEVersion, runtimeERC20BalanceOf } from "../../modules"
import { createOneClickDepositTemplate } from "./createOneClickDepositTemplate"

// @ts-ignore
const { runLifecycleTests } = inject("settings")

describe.runIf(runLifecycleTests)("createOneClickDepositTemplate", () => {
  let eoaAccount: LocalAccount
  let sourceChain: Chain
  let destinationChain: Chain
  let mcNexus: MultichainSmartAccount

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    sourceChain = network.chain
    destinationChain = optimismSepolia

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: sourceChain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: destinationChain,
          transport: http(TESTNET_RPC_URLS[destinationChain.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })
  })

  it("should aggregate transactions", async () => {
    const aaveToMorpho = createOneClickDepositTemplate<{
      amount: bigint
    }>({
      sourceChainInstructions: async ({ sourceChain }) => {
        return mcNexus.buildComposable({
          // dummy transaction
          type: "default",
          data: {
            to: zeroAddress,
            abi: AavePoolAbi,
            args: [
              testnetMcTestUSDCP.addressOn(sourceChain.id),
              100,
              zeroAddress
            ],
            chainId: sourceChain.id,
            functionName: "withdraw"
          }
        })
      },
      bridgeInstructions: async ({ sourceChain, destChain, amount }) => {
        return []
      },
      destChainInstructions: async ({ sourceChain, destChain }) => {
        // dummy instructions
        const approveMorphoToSpendUSDC = await mcNexus.buildComposable({
          type: "approve",
          data: {
            chainId: destChain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(destChain.id),
            spender: zeroAddress,
            amount: runtimeERC20BalanceOf({
              tokenAddress: testnetMcTestUSDC.addressOn(destChain.id),
              targetAddress: mcNexus.addressOn(destChain.id, true)
            })
          }
        })
        const supplyUsdcToMorpho = await mcNexus.buildComposable({
          type: "default",
          data: {
            abi: AavePoolAbi,
            to: zeroAddress,
            chainId: destChain.id,
            functionName: "supply",
            args: [
              testnetMcTestUSDCP.addressOn(destChain.id),
              runtimeERC20BalanceOf({
                tokenAddress: testnetMcTestUSDCP.addressOn(destChain.id),
                targetAddress: mcNexus.addressOn(destChain.id, true)
              }),
              mcNexus.addressOn(destChain.id, true),
              0
            ]
          }
        })
        return [approveMorphoToSpendUSDC, supplyUsdcToMorpho]
      }
    })
    const instructions = await aaveToMorpho({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6)
    })
    expect(instructions.length).toBe(3)
    expect(instructions[0].chainId).toBe(sourceChain.id)
    expect(instructions[1].chainId).toBe(destinationChain.id)
    expect(instructions[2].chainId).toBe(destinationChain.id)
  })
  it("should call the source/bridge/destination instructions", async () => {
    // mock the source/bridge/destination instructions
    const sourceChainInstructions = vi.fn()
    const bridgeInstructions = vi.fn()
    const destChainInstructions = vi.fn()
    const aaveToMorpho = createOneClickDepositTemplate<{
      amount: bigint
      slippage: number
    }>({
      sourceChainInstructions,
      bridgeInstructions,
      destChainInstructions
    })
    await aaveToMorpho({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6),
      slippage: 0.01
    })
    expect(sourceChainInstructions).toHaveBeenCalledWith({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6),
      slippage: 0.01
    })
    expect(bridgeInstructions).toHaveBeenCalledWith({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6),
      slippage: 0.01
    })
    expect(destChainInstructions).toHaveBeenCalledWith({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6),
      slippage: 0.01
    })
  })
})
