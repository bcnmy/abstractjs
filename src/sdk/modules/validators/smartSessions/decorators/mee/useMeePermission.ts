import type { Hash, OneOf } from "viem"
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
  sessionDetails: GrantMeePermissionPayload
} & OneOf<
  | {
      feeToken: FeeTokenInfo
    }
  | {
      sponsorship: true
      sponsorshipOptions?: SponsorshipOptionsParams
    }
>

export type UseMeePermissionPayload = { hash: Hash }

/**
 * Use a MEE Permission
 */
export const useMeePermission = async (
  meeClient_: BaseMeeClient,
  parameters: UseMeePermissionParams
): Promise<UseMeePermissionPayload> => {
  const {
    sessionDetails: sessionDetailsArray,
    mode: mode_,
    instructions
  } = parameters
  const meeClient = meeClient_ as MeeClient

  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  const quote = await meeClient.getQuote({
    instructions,
    moduleAddress: SMART_SESSIONS_ADDRESS,
    shortEncodingSuperTxn: true,
    ...(parameters.sponsorship
      ? {
          sponsorship: parameters.sponsorship,
          sponsorshipOptions: parameters.sponsorshipOptions
        }
      : { feeToken: parameters.feeToken })
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

    // Fix: Handle both number and BigInt chain IDs properly
    const relevantIndex = sessionDetailsArray.findIndex(
      ({ enableSessionData }) => {
        const sessionChainId = enableSessionData?.enableSession?.sessionToEnable?.chainId
        const userOpChainId = userOpEntry.chainId
        
        // Handle both number and BigInt chain IDs
        if (typeof sessionChainId === 'bigint' && typeof userOpChainId === 'number') {
          return sessionChainId === BigInt(userOpChainId)
        }
        if (typeof sessionChainId === 'number' && typeof userOpChainId === 'bigint') {
          return BigInt(sessionChainId) === userOpChainId
        }
        if (typeof sessionChainId === 'bigint' && typeof userOpChainId === 'bigint') {
          return sessionChainId === userOpChainId
        }
        if (typeof sessionChainId === 'number' && typeof userOpChainId === 'number') {
          return sessionChainId === userOpChainId
        }
        return false
      }
    )

    if (relevantIndex === -1) {
      throw new Error(
        `No session details found for chain ID ${userOpEntry.chainId}. ` +
        `Available session details: ${sessionDetailsArray.length} entries.`
      )
    }

    // Fix: Use the mode from session details instead of overriding it
    // The session details already contain the correct mode from grantPermissionTypedDataSign
    const sessionDetails = sessionDetailsArray[relevantIndex]
    const dynamicMode = alreadyUsed ? SmartSessionMode.USE : sessionDetails.mode

    // Set the session details for the user op
    userOpEntry.sessionDetails = {
      ...sessionDetails,
      mode: dynamicMode
    }

    // Remember that the mode has now been catered for
    modeMap[userOpEntry.chainId] = true
  }

  return await meeClient.executeSignedQuote({ signedQuote })
}
