import {
  SMART_SESSIONS_ADDRESS,
  type Session,
  SmartSessionMode,
  encodeSmartSessionSignature,
  type getEnableSessionDetails
} from "@rhinestone/module-sdk"
import type { Hash, Prettify, PublicClient } from "viem"
import type { Call } from "../../../../account/utils"
import { AccountNotFoundError } from "../../../../account/utils/AccountNotFound"
import type { NexusClient } from "../../../../clients/createBicoBundlerClient"
import type { ModularSmartAccount } from "../../../utils/Types"
import { parse } from "../Helpers"

export type UsePermissionParameters<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = {
  /** Additional calls to be included in the user operation. */
  calls: Call[]
  /** Data string returned from grantPermission. Could be stored in local storage or a database. */
  sessionDetails: string
  /** Actions */
  actions: Session["actions"]
  /** Mode. ENABLE the first time, or USE the second time. */
  mode: "ENABLE" | "USE"
  /** Verification gas limit. */
  verificationGasLimit?: bigint
  /** Call gas limit. */
  callGasLimit?: bigint
  /** Pre verification gas. */
  preVerificationGas?: bigint
  /** The maximum fee per gas unit the transaction is willing to pay. */
  maxFeePerGas?: bigint
  /** The maximum priority fee per gas unit the transaction is willing to pay. */
  maxPriorityFeePerGas?: bigint
  /** The nonce of the transaction. If not provided, it will be determined automatically. */
  nonce?: bigint
  /** The modular smart account to create sessions for. If not provided, the client's account will be used. */
  account?: TModularSmartAccount
} & { account?: TModularSmartAccount }
export type UsePermissionResponse = string
export type SessionDetails = Prettify<
  Omit<
    Awaited<ReturnType<typeof getEnableSessionDetails>>,
    "permissionEnableHash"
  >
>

export async function usePermission<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: NexusClient,
  parameters: UsePermissionParameters<TModularSmartAccount>
): Promise<Hash> {
  const {
    account: nexusAccount = nexusClient.account,
    sessionDetails: stringifiedSessionDetails,
    nonce: nonce_,
    mode: mode_,
    ...rest
  } = parameters

  const chainId = nexusAccount?.client.chain?.id
  const publicClient = nexusAccount?.client as PublicClient
  const signer = nexusAccount?.signer
  const mode =
    mode_ === "ENABLE" ? SmartSessionMode.UNSAFE_ENABLE : SmartSessionMode.USE
  const sessionDetails = {
    ...parse(stringifiedSessionDetails),
    mode
  } as SessionDetails
  // @ts-ignore
  const nonce =
    nonce_ ??
    (await nexusAccount.getNonce({ moduleAddress: SMART_SESSIONS_ADDRESS }))

  if (!chainId) {
    throw new Error("Chain ID is not set")
  }
  if (!nexusAccount) {
    throw new AccountNotFoundError({
      docsPath: "/nexus-client/methods#sendtransaction"
    })
  }
  if (!publicClient) {
    throw new Error("Public client is not set")
  }
  if (!signer) {
    throw new Error("Signer is not set")
  }
  if (!sessionDetails.enableSessionData) {
    throw new Error("Session data is not set")
  }

  const userOperation = await nexusClient.prepareUserOperation({
    ...rest,
    signature: encodeSmartSessionSignature(sessionDetails),
    nonce
  })
  const userOpHashToSign = nexusAccount.getUserOpHash(userOperation)
  sessionDetails.signature = await signer.signMessage({
    message: { raw: userOpHashToSign }
  })
  userOperation.signature = encodeSmartSessionSignature(sessionDetails)
  return await nexusClient.sendUserOperation(userOperation)
}
