import type { Hash } from "viem"
import type {
  BaseMeeClient,
  MeeClient
} from "../../../../../clients/createMeeClient"
import type {
  Instruction,
  SponsorshipOptionsParams
} from "../../../../../clients/decorators/mee"
import type { FeeTokenInfo } from "../../../../../clients/decorators/mee"
import {
  SMART_SESSIONS_ADDRESS,
  SmartSessionMode
} from "../../../../../constants"
import type { GrantMeePermissionPayload } from "./grantMeePermission"

export type UseMeePermissionParams = {
  mode: "ENABLE_AND_USE" | "USE"
  instructions: Instruction[]
  feeToken: FeeTokenInfo
  sessionDetails: GrantMeePermissionPayload
  sponsorship?: true
  sponsorshipOptions?: SponsorshipOptionsParams
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
    feeToken,
    sponsorship,
    sponsorshipOptions
  } = parameters
  const meeClient = meeClient_ as MeeClient

  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  const quote = await meeClient.getQuote({
    instructions,
    feeToken,
    moduleAddress: SMART_SESSIONS_ADDRESS,
    shortEncodingSuperTxn: true,
    sponsorship,
    sponsorshipOptions
  })

  const signedQuote = await meeClient.signQuote({ quote })

  const modeMap = signedQuote.userOps.reduce(
    (acc, userOpEntry) => {
      acc[String(userOpEntry.chainId)] = false
      return acc
    },
    {} as Record<string, boolean>
  )

  // Then focus on the other user ops
  for (const [_, userOpEntry] of signedQuote.userOps.entries()) {
    // If we've iterated over this chainId before, it will never require enable mode again.
    const alreadyUsed = !!modeMap[userOpEntry.chainId]

    const relevantIndex = sessionDetailsArray.findIndex(
      ({ enableSessionData }) =>
        enableSessionData?.enableSession?.sessionToEnable?.chainId ===
        BigInt(userOpEntry.chainId)
    )

    // Mark the session as used or unused
    const dynamicMode = alreadyUsed ? SmartSessionMode.USE : mode

    // Set the session details for the user op
    userOpEntry.sessionDetails = {
      ...sessionDetailsArray[relevantIndex],
      mode: dynamicMode
    }

    // Remember that the mode has now been catered for
    modeMap[userOpEntry.chainId] = true
  }

  return await meeClient.executeSignedQuote({ signedQuote })
}
