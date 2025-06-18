import {
  http,
  type Chain,
  type LocalAccount,
  parseUnits,
  zeroAddress
} from "viem"
import { sepolia } from "viem/chains"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account/toMultiChainNexusAccount"
import { AavePoolAbi } from "../../constants/abi"
import { testnetMcUSDC } from "../../constants/tokens"
import { runtimeERC20BalanceOf } from "../../modules"
import { createOneClickDepositTemplate } from "./createOneClickDepositTemplate"
const mocks = vi.hoisted(async () => {
  const { testnetMcUSDC } = await import("../../constants/tokens")

  return {
    getUnifiedERC20BalanceMock: vi.fn().mockResolvedValue({
      mcToken: testnetMcUSDC,
      balance: parseUnits("1", 6),
      decimals: 6,
      breakdown: [
        {
          balance: parseUnits("1", 6),
          decimals: 6,
          chainId: 84532
        }
      ]
    })
  }
})

vi.mock("../../account/decorators/getUnifiedERC20Balance", async () => {
  const resolvedMocks = await mocks
  return {
    getUnifiedERC20Balance: resolvedMocks.getUnifiedERC20BalanceMock
  }
})

describe("createOneClickDepositTemplate", () => {
  let eoaAccount: LocalAccount
  let sourceChain: Chain
  let destinationChain: Chain
  let mcNexus: MultichainSmartAccount

  beforeAll(async () => {
    const network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    sourceChain = network.chain
    destinationChain = sepolia

    mcNexus = await toMultichainNexusAccount({
      chains: [sourceChain, destinationChain],
      transports: [http(), http()],
      signer: eoaAccount
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
            args: [testnetMcUSDC.addressOn(sourceChain.id), 100, zeroAddress],
            chainId: sourceChain.id,
            functionName: "withdraw"
          }
        })
      },
      bridgeInstructions: async ({ sourceChain, destChain, amount }) => {
        // dummy brige call
        return mcNexus.build({
          type: "intent",
          data: {
            amount, // amount here,
            mcToken: testnetMcUSDC,
            toChain: destChain
          }
        })
      },
      destChainInstructions: async ({ sourceChain, destChain }) => {
        // dummy instructions
        const approveMorphoToSpendUSDC = await mcNexus.buildComposable({
          type: "approve",
          data: {
            chainId: destChain.id,
            tokenAddress: testnetMcUSDC.addressOn(destChain.id),
            spender: zeroAddress,
            amount: runtimeERC20BalanceOf({
              tokenAddress: zeroAddress,
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
              testnetMcUSDC.addressOn(destChain.id),
              runtimeERC20BalanceOf({
                tokenAddress: testnetMcUSDC.addressOn(destChain.id),
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
    expect(instructions.length).toBe(4)
    expect(instructions[0].chainId).toBe(sourceChain.id)
    expect(instructions[1].chainId).toBe(sourceChain.id)
    expect(instructions[2].chainId).toBe(destinationChain.id)
    expect(instructions[3].chainId).toBe(destinationChain.id)
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
