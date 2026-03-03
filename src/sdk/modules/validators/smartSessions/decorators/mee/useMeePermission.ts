import type { Hash } from "viem"
import type {
  BaseMeeClient,
  MeeClient
} from "../../../../../clients/createMeeClient"
import type {
  FeePaymentParams,
  Instruction,
  Simulation
} from "../../../../../clients/decorators/mee"
import {
  SMART_SESSIONS_ADDRESS,
  SmartSessionMode
} from "../../../../../constants"
import type { GrantMeePermissionPayload } from "./grantMeePermission"

export type UseMeePermissionParams = {
  mode: "ENABLE_AND_USE" | "USE"
  instructions: Instruction[]
  sessionDetails: GrantMeePermissionPayload
  batch?: boolean
  simulation?: Simulation
  verificationGasLimit?: bigint
} & FeePaymentParams

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
    simulation,
    mode: mode_,
    instructions,
    batch = true,
    verificationGasLimit
  } = parameters
  const meeClient = meeClient_ as MeeClient

  const isEnableAndUseSessionDetailExists = sessionDetailsArray.some(
    (sessionDetailsInfo) =>
      sessionDetailsInfo.mode === SmartSessionMode.UNSAFE_ENABLE
  )

  // If permission/session enabled via prepareForPermission ? The usePermission flow should always use USE mode
  if (!isEnableAndUseSessionDetailExists && mode_ === "ENABLE_AND_USE") {
    throw new Error(
      "ENABLE_AND_USE mode cannot be used with given session details, instead try USE mode directly"
    )
  }

  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  const quote = await meeClient.getQuote({
    instructions,
    moduleAddress: SMART_SESSIONS_ADDRESS,
    shortEncodingSuperTxn: true,
    sessionDetails: sessionDetailsArray,
    smartSessionMode: mode_,
    batch,
    simulation,
    verificationGasLimit,
    ...(parameters.sponsorship
      ? {
          sponsorship: parameters.sponsorship,
          sponsorshipOptions: parameters.sponsorshipOptions
        }
      : { feeToken: parameters.feeToken })
  })

  const signedQuote = await meeClient.signQuote({ quote })

  // Assign the correct mode for each userOp
  // This is required to avoid using ENABLE mode for the same chain more than once
  const processedChains = new Set<string>()
  const startIndex = signedQuote.paymentInfo.sponsored ? 1 : 0

  for (const [index, userOpEntry] of signedQuote.userOps.entries()) {
    // Skip payment userOp if sponsored
    if (index < startIndex) continue

    const chainId = String(userOpEntry.chainId)
    const isFirstTimeForChain = !processedChains.has(chainId)

    // Find session details for this chain
    const relevantIndex = sessionDetailsArray.findIndex(
      ({ enableSessionData }) =>
        enableSessionData?.enableSession?.sessionToEnable?.chainId ===
        BigInt(userOpEntry.chainId)
    )

    if (relevantIndex === -1) {
      throw new Error(
        `No session details found for chainId ${userOpEntry.chainId}`
      )
    }

    // Determine mode: first time gets original mode (enable and use most likely), subsequent times get USE
    const dynamicMode = isFirstTimeForChain ? mode : SmartSessionMode.USE

    // Apply mode to session details
    userOpEntry.sessionDetails = {
      ...sessionDetailsArray[relevantIndex],
      mode: dynamicMode
    }

    // Mark chain as processed
    processedChains.add(chainId)
  }

  return await meeClient.executeSignedQuote({ signedQuote })
}
