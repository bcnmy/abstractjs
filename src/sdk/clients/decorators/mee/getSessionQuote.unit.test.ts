import { decodeAbiParameters } from "viem"
import { describe, expect, test } from "vitest"
import {
  UniversalPolicyAbi,
  buildSessionAction,
  calldataArgument,
  getUniversalActionPolicyConditionType
} from "../../../account"
import { UNIVERSAL_ACTION_POLICY_ADDRESS } from "../../../constants"
import { addPaymentPolicyForActions } from "./getSessionQuote"

describe("addPaymentPolicyForActions", () => {
  test.each(["greaterThan", "greaterThanOrEqual"] as const)(
    "adds an upper payment cap when the existing amount rule is %s",
    (condition) => {
      const feeToken = {
        address: "0x0000000000000000000000000000000000000001" as const,
        chainId: 1
      }
      const maxPaymentAmount = 5_000_000n
      const actions = buildSessionAction({
        type: "transfer",
        data: {
          chainIds: [feeToken.chainId],
          contractAddress: feeToken.address,
          policies: [
            {
              type: "universal",
              rules: [
                {
                  calldataOffset: calldataArgument(2),
                  condition,
                  comparisonValue: 0n
                }
              ]
            }
          ]
        }
      })

      const resolvedActions = addPaymentPolicyForActions(
        actions,
        feeToken,
        maxPaymentAmount
      )
      const universalPolicy = resolvedActions[0].actions[0].actionPolicies.find(
        ({ policy }) =>
          policy.toLowerCase() === UNIVERSAL_ACTION_POLICY_ADDRESS.toLowerCase()
      )

      expect(universalPolicy).toBeDefined()

      const [policyData] = decodeAbiParameters(
        UniversalPolicyAbi,
        universalPolicy!.initData
      )

      expect(policyData.paramRules.length).toBe(2n)
      expect(policyData.paramRules.rules[0].condition).toBe(
        getUniversalActionPolicyConditionType(condition)
      )
      expect(policyData.paramRules.rules[1].offset).toBe(calldataArgument(2))
      expect(policyData.paramRules.rules[1].condition).toBe(
        getUniversalActionPolicyConditionType("lessThanOrEqual")
      )
      expect(BigInt(policyData.paramRules.rules[1].ref)).toBe(maxPaymentAmount)
    }
  )
})
