import type { MultichainAddressMapping } from "../../../../../account/decorators/buildBridgeInstructions"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import type { Instruction } from "../../../../../clients/decorators/mee"
import {
  SmartSessionMode,
  encodeSmartSessionSignature
} from "../../../../../constants"
import { SMART_SESSIONS_ADDRESS } from "../../../../../constants"
import type { GrantMeePermissionPayload } from "./grantMeePermission"

export type UseMeePermissionParams = {
  sessionDetails: GrantMeePermissionPayload
  addressMapping: MultichainAddressMapping
  mode: "ENABLE_AND_USE" | "USE"
}

export type UseMeePermissionPayload = {
  instructions: Instruction[]
}

export const useMeePermission = async (
  meeClient: BaseMeeClient,
  parameters: UseMeePermissionParams
): Promise<UseMeePermissionPayload> => {
  const {
    sessionDetails: sessionDetailsArray,
    addressMapping,
    mode: mode_
  } = parameters
  const mcAccount = meeClient.account

  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  console.log({ sessionDetailsArray, addressMapping, mode })

  const instructions: Instruction[] = await Promise.all(
    mcAccount.deployments.map(async (account, index) => {
      const chainId = account.client.chain?.id
      if (!chainId) {
        throw new Error("Chain ID is not set")
      }

      const sessionDetails = { ...sessionDetailsArray[index], mode }

      // @ts-ignore
      const nonce = await account.getNonce({
        moduleAddress: SMART_SESSIONS_ADDRESS
      })

      const factoryArgs = await account.getFactoryArgs()

      const userOperation = {
        ...factoryArgs,
        signature: encodeSmartSessionSignature(sessionDetails),
        nonce
      }

      const userOpHashToSign = account.getUserOpHash(userOperation)
      sessionDetails.signature = await account.signer.signMessage({
        message: { raw: userOpHashToSign }
      })
      userOperation.signature = encodeSmartSessionSignature(sessionDetails)

      return {
        calls: [
          {
            to: account.address,
            data: encodeSmartSessionSignature(sessionDetails)
          }
        ],
        chainId,
        isComposable: false
      }
    })
  )

  return { instructions }
}
