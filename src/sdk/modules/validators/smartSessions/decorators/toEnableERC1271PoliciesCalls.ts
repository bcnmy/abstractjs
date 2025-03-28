import {
  type ERC7739Data,
  getEnableERC1271PoliciesAction
} from "@rhinestone/module-sdk"
import type { Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

/**
 * Converts permission ID and ERC1271 policies into enable policies calls
 */
export const toEnableERC1271PoliciesCalls = async (
  _: ModularSmartAccount,
  parameters: { permissionId: Hex; erc1271Policies: ERC7739Data }
): Promise<Call[]> => {
  const action = getEnableERC1271PoliciesAction({
    permissionId: parameters.permissionId,
    erc1271Policies: parameters.erc1271Policies
  })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
