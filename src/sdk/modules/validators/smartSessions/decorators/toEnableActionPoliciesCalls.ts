import {
  type ActionData,
  getEnableActionPoliciesAction
} from "@rhinestone/module-sdk"
import type { Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

/**
 * Converts permission ID and action policies into enable action policies calls
 */
export const toEnableActionPoliciesCalls = async (
  _: ModularSmartAccount,
  parameters: { permissionId: Hex; actionPolicies: ActionData[] }
): Promise<Call[]> => {
  const action = getEnableActionPoliciesAction({
    permissionId: parameters.permissionId,
    actionPolicies: parameters.actionPolicies
  })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
