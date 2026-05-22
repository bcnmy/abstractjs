import { type Address, decodeAbiParameters, erc20Abi, parseUnits } from "viem"
import { describe, expect, test } from "vitest"
import { buildComposableCall } from "../../account/decorators/instructions/buildComposable"
import { ComposabilityVersion } from "../../constants"
import {
  CONSTRAINT_TUPLE_ABI,
  ConstraintType,
  InputParamFetcherType,
  equalTo,
  greaterThanOrEqualTo,
  greaterThanOrEqualToSigned,
  lessThanOrEqualTo,
  lessThanOrEqualToSigned,
  orConstraint,
  runtimeERC20BalanceOf,
  validateAndProcessConstraints
} from "./composabilityCalls"
import {
  ConditionType,
  createCondition,
  createConditionInputParam
} from "./conditions"

describe("Conditional Execution - Unit Tests", () => {
  describe("condition builders", () => {
    const mockContract = "0x1234567890123456789012345678901234567890" as Address

    test("createCondition should create a condition with GTE constraint", () => {
      const cond = createCondition({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        value: 1000n,
        type: ConditionType.GTE,
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

    test("createCondition should create a condition with LTE constraint", () => {
      const cond = createCondition({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        value: 5000n,
        type: ConditionType.LTE,
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

    test("createCondition should create a condition with EQ constraint", () => {
      const cond = createCondition({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "totalSupply",
        args: [],
        value: 1000000n,
        type: ConditionType.EQ,
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
        functionName: "balanceOf" as const,
        args: [mockContract] as [Address],
        value: 1000n
      }

      const conditionGt = createCondition({
        ...conditionParams,
        type: ConditionType.GTE
      })
      const conditionLt = createCondition({
        ...conditionParams,
        type: ConditionType.LTE
      })
      const conditionEq = createCondition({
        ...conditionParams,
        type: ConditionType.EQ
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

  describe("validateAndProcessConstraints — signed integer and OR constraints", () => {
    test("greaterThanOrEqualToSigned encodes a positive bigint correctly", () => {
      const result = validateAndProcessConstraints([
        greaterThanOrEqualToSigned(100n)
      ])
      expect(result).toHaveLength(1)
      expect(result[0].constraintType).toBe(ConstraintType.GTE_SIGNED)
      expect(result[0].referenceData).toBeDefined()
    })

    test("greaterThanOrEqualToSigned encodes a negative bigint correctly", () => {
      const result = validateAndProcessConstraints([
        greaterThanOrEqualToSigned(-42n)
      ])
      expect(result).toHaveLength(1)
      expect(result[0].constraintType).toBe(ConstraintType.GTE_SIGNED)
      // negative value must be encoded in two's-complement — referenceData must be non-zero
      expect(result[0].referenceData).not.toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      )
    })

    test("lessThanOrEqualToSigned encodes a negative bigint correctly", () => {
      const result = validateAndProcessConstraints([
        lessThanOrEqualToSigned(-1n)
      ])
      expect(result).toHaveLength(1)
      expect(result[0].constraintType).toBe(ConstraintType.LTE_SIGNED)
    })

    test("greaterThanOrEqualToSigned throws for non-bigint value", () => {
      expect(() =>
        validateAndProcessConstraints([
          greaterThanOrEqualToSigned("0x1234" as unknown as bigint)
        ])
      ).toThrow("signed constraints require bigint")
    })

    test("orConstraint encodes sub-constraints into referenceData", () => {
      const result = validateAndProcessConstraints([
        orConstraint([greaterThanOrEqualTo(10n), lessThanOrEqualTo(100n)])
      ])
      expect(result).toHaveLength(1)
      expect(result[0].constraintType).toBe(ConstraintType.OR)
      expect(result[0].referenceData.length).toBeGreaterThan(2)
    })

    test("orConstraint throws for nested OR (OR inside OR)", () => {
      expect(() =>
        validateAndProcessConstraints([
          orConstraint([
            orConstraint([greaterThanOrEqualTo(1n)]) as unknown as ReturnType<
              typeof greaterThanOrEqualTo
            >
          ])
        ])
      ).toThrow("Nested OR constraints are not supported")
    })

    test("orConstraint throws for empty sub-constraint array", () => {
      expect(() => validateAndProcessConstraints([orConstraint([])])).toThrow(
        "OR constraint must have at least one sub-constraint"
      )
    })

    test("orConstraint with signed sub-constraints encodes GTE_SIGNED and LTE_SIGNED correctly", () => {
      const result = validateAndProcessConstraints([
        orConstraint([
          greaterThanOrEqualToSigned(-1n),
          lessThanOrEqualToSigned(parseUnits("100", 6))
        ])
      ])
      expect(result).toHaveLength(1)
      expect(result[0].constraintType).toBe(ConstraintType.OR)

      // Decode the OR's referenceData to verify sub-constraint types and encoding
      const [subs] = decodeAbiParameters(
        [CONSTRAINT_TUPLE_ABI],
        result[0].referenceData as `0x${string}`
      )
      expect(subs).toHaveLength(2)
      expect(subs[0].constraintType).toBe(ConstraintType.GTE_SIGNED)
      expect(subs[1].constraintType).toBe(ConstraintType.LTE_SIGNED)

      // -1n must be two's-complement encoded (all 0xff), not zero-padded as unsigned
      expect((subs[0].referenceData as string).toLowerCase()).toContain(
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      )
      // 100 USDC (1e8) must be present; non-negative so it encodes as a small positive value
      expect(subs[1].referenceData).not.toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      )
    })

    test("ConditionType.GTE_SIGNED maps to the signed GTE helper", () => {
      const mockContract =
        "0x1234567890123456789012345678901234567890" as Address
      const cond = createCondition({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        value: -5n,
        type: ConditionType.GTE_SIGNED,
        description: "Must be >= -5 (signed)"
      })
      expect(cond.constraint).toEqual({
        type: ConstraintType.GTE_SIGNED,
        value: -5n
      })
    })

    test("ConditionType.LTE_SIGNED maps to the signed LTE helper", () => {
      const mockContract =
        "0x1234567890123456789012345678901234567890" as Address
      const cond = createCondition({
        targetContract: mockContract,
        functionAbi: erc20Abi,
        functionName: "balanceOf",
        args: [mockContract],
        value: 0n,
        type: ConditionType.LTE_SIGNED
      })
      expect(cond.constraint).toEqual({
        type: ConstraintType.LTE_SIGNED,
        value: 0n
      })
    })

    test("unsigned GTE still rejects negative bigint", () => {
      expect(() =>
        validateAndProcessConstraints([greaterThanOrEqualTo(-1n)])
      ).toThrow("Invalid constraint value")
    })
  })

  describe("buildComposableCall — version guard for OR / signed-integer constraints", () => {
    const TOKEN = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address
    const SPENDER = "0x1234567890123456789012345678901234567890" as Address

    const buildParams = (
      constraints: ReturnType<typeof greaterThanOrEqualTo>[]
    ) => ({
      to: TOKEN,
      functionName: "transferFrom",
      abi: erc20Abi,
      chainId: 1,
      args: [
        SPENDER,
        SPENDER,
        runtimeERC20BalanceOf({
          targetAddress: SPENDER,
          tokenAddress: TOKEN,
          constraints
        })
      ]
    })

    test("OR constraint throws for ComposabilityVersion.V1_0_0", async () => {
      await expect(
        buildComposableCall(
          buildParams([orConstraint([greaterThanOrEqualTo(1n)])]),
          { composabilityVersion: ComposabilityVersion.V1_0_0 }
        )
      ).rejects.toThrow("OR constraints require Composability v1.1.1")
    })

    test("OR constraint throws for ComposabilityVersion.V1_1_0", async () => {
      await expect(
        buildComposableCall(
          buildParams([orConstraint([greaterThanOrEqualTo(1n)])]),
          { composabilityVersion: ComposabilityVersion.V1_1_0 }
        )
      ).rejects.toThrow("OR constraints require Composability v1.1.1")
    })

    test("OR constraint succeeds for ComposabilityVersion.V1_1_1", async () => {
      const result = await buildComposableCall(
        buildParams([
          orConstraint([greaterThanOrEqualTo(1n), lessThanOrEqualTo(100n)])
        ]),
        { composabilityVersion: ComposabilityVersion.V1_1_1 }
      )
      expect(result.length).toBeGreaterThan(0)
    })

    test("GTE_SIGNED constraint throws for ComposabilityVersion.V1_0_0", async () => {
      await expect(
        buildComposableCall(buildParams([greaterThanOrEqualToSigned(-10n)]), {
          composabilityVersion: ComposabilityVersion.V1_0_0
        })
      ).rejects.toThrow("signed integer")
    })

    test("GTE_SIGNED constraint throws for ComposabilityVersion.V1_1_0", async () => {
      await expect(
        buildComposableCall(buildParams([greaterThanOrEqualToSigned(-10n)]), {
          composabilityVersion: ComposabilityVersion.V1_1_0
        })
      ).rejects.toThrow("signed integer")
    })

    test("GTE_SIGNED constraint succeeds for ComposabilityVersion.V1_1_1", async () => {
      const result = await buildComposableCall(
        buildParams([greaterThanOrEqualToSigned(-10n)]),
        { composabilityVersion: ComposabilityVersion.V1_1_1 }
      )
      expect(result.length).toBeGreaterThan(0)
    })

    test("LTE_SIGNED constraint throws for ComposabilityVersion.V1_1_0", async () => {
      await expect(
        buildComposableCall(buildParams([lessThanOrEqualToSigned(0n)]), {
          composabilityVersion: ComposabilityVersion.V1_1_0
        })
      ).rejects.toThrow("signed integer")
    })

    test("LTE_SIGNED constraint succeeds for ComposabilityVersion.V1_1_1", async () => {
      const result = await buildComposableCall(
        buildParams([lessThanOrEqualToSigned(0n)]),
        { composabilityVersion: ComposabilityVersion.V1_1_1 }
      )
      expect(result.length).toBeGreaterThan(0)
    })

    test("OR with signed sub-constraints succeeds for ComposabilityVersion.V1_1_1", async () => {
      const result = await buildComposableCall(
        buildParams([
          orConstraint([
            greaterThanOrEqualToSigned(-1n),
            lessThanOrEqualToSigned(parseUnits("100", 6))
          ])
        ]),
        { composabilityVersion: ComposabilityVersion.V1_1_1 }
      )
      expect(result.length).toBeGreaterThan(0)
    })

    test("OR with signed sub-constraints throws for ComposabilityVersion.V1_1_0", async () => {
      await expect(
        buildComposableCall(
          buildParams([
            orConstraint([
              greaterThanOrEqualToSigned(-1n),
              lessThanOrEqualToSigned(parseUnits("100", 6))
            ])
          ]),
          { composabilityVersion: ComposabilityVersion.V1_1_0 }
        )
      ).rejects.toThrow("OR constraints require Composability v1.1.1")
    })

    test("plain GTE constraint (unsigned) still works for V1_1_0", async () => {
      const result = await buildComposableCall(
        buildParams([greaterThanOrEqualTo(1n)]),
        { composabilityVersion: ComposabilityVersion.V1_1_0 }
      )
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
