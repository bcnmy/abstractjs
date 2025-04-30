import type { Hash } from "viem"
import type { MultichainAddressMapping } from "../../../../../account/decorators/buildBridgeInstructions"
import type { Call } from "../../../../../account/utils/Types"
import type {
  BaseMeeClient,
  MeeClient
} from "../../../../../clients/createMeeClient"
import type { Instruction } from "../../../../../clients/decorators/mee"
import type { FeeTokenInfo } from "../../../../../clients/decorators/mee"
import { SmartSessionMode } from "../../../../../constants"
import type { GrantMeePermissionPayload } from "./grantMeePermission"

export type UseMeePermissionParams = {
  sessionDetails: GrantMeePermissionPayload
  addressMapping: MultichainAddressMapping
  mode: "ENABLE_AND_USE" | "USE"
  instructions: Instruction[]
  feeToken: FeeTokenInfo
}

export type UseMeePermissionPayload = { hash: Hash }

export const useMeePermission = async (
  meeClient_: BaseMeeClient,
  parameters: UseMeePermissionParams
): Promise<UseMeePermissionPayload> => {
  const {
    sessionDetails: sessionDetailsArray,
    addressMapping,
    mode: mode_,
    instructions,
    feeToken
  } = parameters
  const meeClient = meeClient_ as MeeClient
  const mcAccount = meeClient.account

  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  console.log("instructions.length", instructions.length)

  const quote = await meeClient.getQuote({ instructions, feeToken })
  const signedQuote = await meeClient.signQuote({ quote })
  console.log({ signedQuote })

  for (const [i, { userOp, chainId }] of signedQuote.userOps.entries()) {
    if (i !== 0) continue // Skip the first user op, as it's the payment user op
    const relevantIndex = sessionDetailsArray.findIndex(
      ({ enableSessionData }) =>
        enableSessionData?.enableSession?.sessionToEnable?.chainId ===
        BigInt(chainId)
    )
    userOp.sessionDetails = { ...sessionDetailsArray[relevantIndex], mode }
  }
  console.log("signedQuote.userOps", signedQuote.userOps)
  console.log(
    "signedQuote.userOps[0]",
    signedQuote.userOps[0].userOp.sessionDetails
  )

  return await meeClient.executeSignedQuote({ signedQuote })
}
