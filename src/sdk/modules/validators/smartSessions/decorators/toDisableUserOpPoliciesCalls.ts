import { getDisableUserOpPoliciesAction } from "@rhinestone/module-sdk"
import type { Address, Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

/**
 * Converts permission ID and policies into disable UserOp policies calls
 */
export const toDisableUserOpPoliciesCalls = async (
  _: ModularSmartAccount,
  parameters: { permissionId: Hex; userOpPolicies: Address[] }
): Promise<Call[]> => {
  const action = getDisableUserOpPoliciesAction({
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
