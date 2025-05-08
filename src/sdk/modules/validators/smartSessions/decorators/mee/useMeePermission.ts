import type { Hash } from "viem"
import type { MultichainAddressMapping } from "../../../../../account/decorators/buildBridgeInstructions"
import type {
  BaseMeeClient,
  MeeClient
} from "../../../../../clients/createMeeClient"
import type { Instruction } from "../../../../../clients/decorators/mee"
import type { FeeTokenInfo } from "../../../../../clients/decorators/mee"
import {
  SMART_SESSIONS_ADDRESS,
  SmartSessionMode
} from "../../../../../constants"
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
    mode: mode_,
    instructions,
    feeToken
  } = parameters
  const meeClient = meeClient_ as MeeClient
  const mcAccount = meeClient.account

  console.log(
    "mcAccount",
    mcAccount.deployments.map(({ chain }) => chain.id)
  )

  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  const instructionsWithSmartSessions = instructions.map((instruction) => ({
    ...instruction,
    moduleAddress: SMART_SESSIONS_ADDRESS
  }))

  const quote = await meeClient.getQuote({
    instructions: instructionsWithSmartSessions,
    feeToken
  })
  const signedQuote = await meeClient.signQuote({ quote })

  for (const [i, userOpEntry] of signedQuote.userOps.entries()) {
    if (i !== 0) continue // Skip the first user op, as it's the payment user op
    const relevantIndex = sessionDetailsArray.findIndex(
      ({ enableSessionData }) =>
        enableSessionData?.enableSession?.sessionToEnable?.chainId ===
        BigInt(userOpEntry.chainId)
    )
    userOpEntry.sessionDetails = { ...sessionDetailsArray[relevantIndex], mode }
  }

  return await meeClient.executeSignedQuote({ signedQuote })
}
