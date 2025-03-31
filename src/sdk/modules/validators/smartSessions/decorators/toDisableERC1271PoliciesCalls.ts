import {
  type ERC7739Context,
  getDisableERC1271PoliciesAction
} from "@rhinestone/module-sdk"
import type { Address, Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

/**
 * Converts permission ID, policies and contents into disable ERC1271 policies calls
 */
export const toDisableERC1271PoliciesCalls = async (
  _: ModularSmartAccount,
  parameters: {
    permissionId: Hex
    policies: Address[]
    contents: ERC7739Context[]
  }
): Promise<Call[]> => {
  const action = getDisableERC1271PoliciesAction({
    permissionId: parameters.permissionId,
    policies: parameters.policies,
    contents: parameters.contents
  })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
