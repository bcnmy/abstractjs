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
    const aaveToMorpho = createOneClickDepositTemplate({
      sourceChainInstructions: async ({ chain }) => {
        return mcNexus.buildComposable({
          // dummy transaction
          type: "default",
          data: {
            to: zeroAddress,
            abi: AavePoolAbi,
            args: [testnetMcUSDC.addressOn(chain.id), 100, zeroAddress],
            chainId: chain.id,
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
      destChainInstructions: async ({ chain }) => {
        // dummy instructions
        const approveAAVEtoSpendUSDC = await mcNexus.buildComposable({
          type: "approve",
          data: {
            chainId: chain.id,
            tokenAddress: testnetMcUSDC.addressOn(chain.id),
            spender: zeroAddress,
            amount: runtimeERC20BalanceOf({
              tokenAddress: zeroAddress,
              targetAddress: mcNexus.addressOn(chain.id, true)
            })
          }
        })
        const supplyUsdcToAAVE = await mcNexus.buildComposable({
          type: "default",
          data: {
            abi: AavePoolAbi,
            to: zeroAddress,
            chainId: chain.id,
            functionName: "supply",
            args: [
              testnetMcUSDC.addressOn(chain.id),
              runtimeERC20BalanceOf({
                tokenAddress: testnetMcUSDC.addressOn(chain.id),
                targetAddress: mcNexus.addressOn(chain.id, true)
              }),
              mcNexus.addressOn(chain.id, true),
              0
            ]
          }
        })
        return [approveAAVEtoSpendUSDC, supplyUsdcToAAVE]
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
    const sourceInstructions = vi.fn()
    const bridgeInstructions = vi.fn()
    const destinationInstructions = vi.fn()
    const aaveToMorpho = createOneClickDepositTemplate({
      sourceChainInstructions: sourceInstructions,
      bridgeInstructions: bridgeInstructions,
      destChainInstructions: destinationInstructions
    })
    await aaveToMorpho({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6)
    })
    expect(sourceInstructions).toHaveBeenCalledWith({
      chain: sourceChain
    })
    expect(bridgeInstructions).toHaveBeenCalledWith({
      sourceChain,
      destChain: destinationChain,
      amount: parseUnits("1", 6)
    })
    expect(destinationInstructions).toHaveBeenCalledWith({
      chain: destinationChain
    })
  })
})
