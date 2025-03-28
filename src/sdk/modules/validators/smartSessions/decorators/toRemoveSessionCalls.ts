import { getRemoveSessionAction } from "@rhinestone/module-sdk"
import type { Hex } from "viem"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

export const toRemoveSessionCalls = async (
  _: ModularSmartAccount,
  parameters: { permissionId: Hex }
): Promise<Call[]> => {
  const action = getRemoveSessionAction({
    permissionId: parameters.permissionId
  })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
