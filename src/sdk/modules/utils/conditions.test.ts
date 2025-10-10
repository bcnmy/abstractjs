import { type Address, erc20Abi } from "viem"
import { describe, expect, test } from "vitest"
import {
  ConstraintType,
  InputParamFetcherType,
  equalTo,
  greaterThanOrEqualTo,
  lessThanOrEqualTo
} from "./composabilityCalls"
import { condition, createConditionInputParam } from "./conditions"

describe("Conditional Execution - Unit Tests", () => {
  describe("condition builders", () => {
    const mockContract = "0x1234567890123456789012345678901234567890" as Address

    test("condition.greaterThan should create a condition with GTE constraint", () => {
      const cond = condition.greaterThan({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        threshold: 1000n,
        description: "Min balance 1000"
      })

      expect(cond.targetContract).toBe(mockContract)
      expect(cond.functionAbi).toBe(erc20Abi)
      expect(cond.functionName).toBe("balanceOf")
      expect(cond.args).toEqual([mockContract])
      expect(cond.constraint).toEqual({
        type: ConstraintType.GTE,
        value: 1000n
      })
      expect(cond.description).toBe("Min balance 1000")
    })

    test("condition.lessThan should create a condition with LTE constraint", () => {
      const cond = condition.lessThan({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        threshold: 5000n,
        description: "Max balance 5000"
      })

      expect(cond.targetContract).toBe(mockContract)
      expect(cond.functionName).toBe("balanceOf")
      expect(cond.constraint).toEqual({
        type: ConstraintType.LTE,
        value: 5000n
      })
      expect(cond.description).toBe("Max balance 5000")
    })

    test("condition.equalTo should create a condition with EQ constraint", () => {
      const cond = condition.equalTo({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "totalSupply",
        args: [],
        expectedValue: 1000000n,
        description: "Total supply must equal 1000000"
      })

      expect(cond.targetContract).toBe(mockContract)
      expect(cond.functionName).toBe("totalSupply")
      expect(cond.constraint).toEqual({
        type: ConstraintType.EQ,
        value: 1000000n
      })
      expect(cond.description).toBe("Total supply must equal 1000000")
    })
  })

  describe("createConditionInputParam", () => {
    const mockContract = "0x1234567890123456789012345678901234567890" as Address

    test("should create InputParam with STATIC_CALL fetcher type", () => {
      const cond = condition.greaterThan({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        threshold: 1000n
      })

      const inputParam = createConditionInputParam(cond)

      expect(inputParam.fetcherType).toBe(InputParamFetcherType.STATIC_CALL)
      expect(inputParam).toMatchInlineSnapshot(`
        {
          "constraints": [
            {
              "constraintType": 1,
              "referenceData": "0x00000000000000000000000000000000000000000000000000000000000003e8",
            },
          ],
          "fetcherType": 1,
          "paramData": "0x00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000",
        }
      `)
    })

    test("should encode target contract and function data correctly", () => {
      const cond = condition.greaterThan({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        threshold: 500n
      })

      const inputParam = createConditionInputParam(cond)

      // paramData should be abi.encodePacked(address, bytes)
      // It should contain the encoded function call
      expect(inputParam.paramData).toContain(
        mockContract.slice(2).toLowerCase()
      )
    })

    test("should handle different constraint types", () => {
      const conditions = [
        condition.greaterThan({
          targetContract: mockContract,
          functionAbi: erc20Abi,
          functionName: "balanceOf",
          args: [mockContract],
          threshold: 100n
        }),
        condition.lessThan({
          targetContract: mockContract,
          functionAbi: erc20Abi,
          functionName: "balanceOf",
          args: [mockContract],
          threshold: 200n
        }),
        condition.equalTo({
          targetContract: mockContract,
          functionAbi: erc20Abi,
          functionName: "totalSupply",
          args: [],
          expectedValue: 1000000n
        })
      ]

      for (const cond of conditions) {
        const inputParam = createConditionInputParam(cond)
        expect(inputParam.fetcherType).toBe(InputParamFetcherType.STATIC_CALL)
        expect(inputParam.constraints.length).toBeGreaterThan(0)
      }
    })
  })
})
