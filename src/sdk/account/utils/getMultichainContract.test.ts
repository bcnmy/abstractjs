import { type Address, erc20Abi, parseEther } from "viem"
import { base, optimism } from "viem/chains"
import { describe, expect, it } from "vitest"
import { getMultichainContract } from "./getMultichainContract"

describe("mee.getMultichainContract", () => {
  const mockDeployments: [Address, number][] = [
    ["0x1234567890123456789012345678901234567890", optimism.id],
    ["0x0987654321098765432109876543210987654321", base.id]
  ]

  const mockContract = getMultichainContract({
    abi: erc20Abi,
    deployments: mockDeployments
  })

  it("should return an instruction", async () => {
    mockContract.on(optimism.id).transfer({
      args: ["0x1111111111111111111111111111111111111111", parseEther("1.0")]
    })

    const instruction = await mockContract.build({
      type: "transfer",
      data: {
        chainId: optimism.id,
        args: ["0x1111111111111111111111111111111111111111", parseEther("1.0")]
      }
    })

    expect(instruction).toBeDefined()
    expect(instruction.calls).toHaveLength(1)
    expect(instruction.chainId).toBe(optimism.id)
  })

  it("should create a contract instance with correct deployments", () => {
    expect(mockContract.deployments.get(optimism.id)).toBe(
      mockDeployments[0][0]
    )
    expect(mockContract.deployments.get(base.id)).toBe(mockDeployments[1][0])
  })

  it("should return correct address for a chain", () => {
    expect(mockContract.addressOn(optimism.id)).toBe(mockDeployments[0][0])
    expect(mockContract.addressOn(base.id)).toBe(mockDeployments[1][0])
  })

  it("should throw error for non-existent chain deployment", () => {
    expect(() => mockContract.addressOn(1)).toThrow(
      "No deployment found for chain 1"
    )
    expect(() => mockContract.on(1)).toThrow("No deployment found for chain 1")
  })

  it("should create valid transfer instructions", () => {
    const recipient = "0x1111111111111111111111111111111111111111"
    const amount = parseEther("1.0")
    const gasLimit = 100000n

    const instruction = mockContract.on(optimism.id).transfer({
      args: [recipient, amount],
      gasLimit
    })

    expect(instruction).toMatchObject({
      chainId: optimism.id,
      calls: [
        {
          to: mockDeployments[0][0],
          gasLimit,
          value: 0n,
          data: expect.any(String) // We could decode this to verify if needed
        }
      ]
    })
  })

  it("should throw error for non-existent function", () => {
    expect(() => {
      // @ts-expect-error - Testing invalid function call
      mockContract.on(optimism.id).nonExistentFunction({
        args: [],
        gasLimit: 100000n
      })
    }).toThrow("Function nonExistentFunction not found in ABI")
  })
})
