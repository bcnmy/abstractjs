import {
  type PolicyData,
  getEnableUserOpPoliciesAction
} from "@rhinestone/module-sdk"
import type { Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

/**
 * Converts permission ID and policies into disable UserOp policies calls
 */
export const toEnableUserOpPoliciesCalls = async (
  _: ModularSmartAccount,
  parameters: { permissionId: Hex; userOpPolicies: PolicyData[] }
): Promise<Call[]> => {
  const action = getEnableUserOpPoliciesAction({
    permissionId: parameters.permissionId,
    userOpPolicies: parameters.userOpPolicies
  })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
