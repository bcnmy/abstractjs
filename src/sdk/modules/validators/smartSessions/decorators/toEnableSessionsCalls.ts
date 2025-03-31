import { type Session, getEnableSessionsAction } from "@rhinestone/module-sdk"
import type { Call } from "../../../../account/utils/Types"
import type { ModularSmartAccount } from "../../../utils/Types"

export const toEnableSessionsCalls = async (
  _: ModularSmartAccount,
  parameters: { sessions: Session[] }
): Promise<Call[]> => {
  const action = getEnableSessionsAction({ sessions: parameters.sessions })
  return [
    {
      to: action.target,
      value: BigInt(action.value.toString()),
      data: action.callData
    }
  ]
}
