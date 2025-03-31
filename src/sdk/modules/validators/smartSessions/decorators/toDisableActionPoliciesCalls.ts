import { getDisableActionPoliciesAction } from "@rhinestone/module-sdk"
import type { Address, Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

/**
 * Converts permission ID, action ID and policies into disable action policies calls
 */
export const toDisableActionPoliciesCalls = async (
  _: ModularSmartAccount,
  parameters: {
    permissionId: Hex
    actionId: Hex
    policies: Address[]
  }
): Promise<Call[]> => {
  const action = getDisableActionPoliciesAction({
    permissionId: parameters.permissionId,
    actionId: parameters.actionId,
    policies: parameters.policies
  })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
