import { type Session, getEnableSessionsAction } from "@rhinestone/module-sdk"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"
import { assertNoErc1271SessionPolicies } from "../Helpers"

export const toEnableSessionsCalls = async (
  _: ModularSmartAccount,
  parameters: { sessions: Session[] }
): Promise<Call[]> => {
  for (const session of parameters.sessions) {
    assertNoErc1271SessionPolicies(
      session.erc7739Policies,
      "toEnableSessionsCalls"
    )
  }
  const action = getEnableSessionsAction({ sessions: parameters.sessions })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
