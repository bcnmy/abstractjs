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

    test("condition.greaterThanOrEqualTo should create a condition with GTE constraint", () => {
      const cond = condition.greaterThanOrEqualTo({
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

    test("condition.lessThanOrEqualTo should create a condition with LTE constraint", () => {
      const cond = condition.lessThanOrEqualTo({
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

    test("should create InputParam with STATIC_CALL fetcher type and the encoded function call", () => {
      const conditionParams = {
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        threshold: 1000n
      }

      const conditionGt = condition.greaterThanOrEqualTo(conditionParams)
      const conditionLt = condition.lessThanOrEqualTo(conditionParams)
      const conditionEq = condition.equalTo({
        ...conditionParams,
        expectedValue: 1000n
      })

      const inputParamGt = createConditionInputParam(conditionGt)
      const inputParamLt = createConditionInputParam(conditionLt)
      const inputParamEq = createConditionInputParam(conditionEq)

      expect(inputParamGt.fetcherType).toBe(InputParamFetcherType.STATIC_CALL)
      expect(inputParamGt.paramData).toContain(
        mockContract.slice(2).toLowerCase()
      ) // should be abi.encodePacked(address, bytes) particularly
      expect(inputParamGt).toMatchInlineSnapshot(`
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

      expect(inputParamLt.fetcherType).toBe(InputParamFetcherType.STATIC_CALL)
      expect(inputParamLt.paramData).toContain(
        mockContract.slice(2).toLowerCase()
      ) // should be abi.encodePacked(address, bytes) particularly
      expect(inputParamLt).toMatchInlineSnapshot(`
      {
        "constraints": [
          {
            "constraintType": 2,
            "referenceData": "0x00000000000000000000000000000000000000000000000000000000000003e8",
          },
        ],
        "fetcherType": 1,
        "paramData": "0x00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000",
      }
    `)

      expect(inputParamEq.fetcherType).toBe(InputParamFetcherType.STATIC_CALL)
      expect(inputParamEq.paramData).toContain(
        mockContract.slice(2).toLowerCase()
      ) // should be abi.encodePacked(address, bytes) particularly
      expect(inputParamEq).toMatchInlineSnapshot(`
      {
        "constraints": [
          {
            "constraintType": 0,
            "referenceData": "0x00000000000000000000000000000000000000000000000000000000000003e8",
          },
        ],
        "fetcherType": 1,
        "paramData": "0x00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000002470a08231000000000000000000000000123456789012345678901234567890123456789000000000000000000000000000000000000000000000000000000000",
      }
    `)

      // reference data should be the same
      expect(inputParamGt.constraints[0].referenceData).toBe(
        inputParamLt.constraints[0].referenceData
      )
      expect(inputParamGt.constraints[0].referenceData).toBe(
        inputParamEq.constraints[0].referenceData
      )

      // paramData should be the same
      expect(inputParamGt.paramData).toBe(inputParamLt.paramData)
      expect(inputParamGt.paramData).toBe(inputParamEq.paramData)
    })
  })
})
