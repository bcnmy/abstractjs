import {
  SMART_SESSIONS_ADDRESS,
  SmartSessionMode,
  encodeSmartSessionSignature
} from "@rhinestone/module-sdk"
import type { Chain, Client, Hash, PublicClient, Transport } from "viem"
import {
  prepareUserOperation,
  sendUserOperation
} from "viem/account-abstraction"
import type { Call } from "../../../../account/utils"
import { AccountNotFoundError } from "../../../../account/utils/AccountNotFound"
import type { AnyData, ModularSmartAccount } from "../../../utils/Types"
import type { GrantPermissionResponse } from "./grantPermission"

export type UsePermissionParameters<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = {
  /** Additional calls to be included in the user operation. */
  calls: Call[]
  /** Data string returned from grantPermission. Could be stored in local storage or a database. */
  sessionDetailsArray: GrantPermissionResponse
  /** Index within chain: specifies which session to use if some chain has multiple sessions. */
  indexWithinChain?: number
  /** Mode. ENABLE the first time, or USE when > 1 time. */
  mode: "ENABLE_AND_USE" | "USE"
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

export type UsePermissionResponse = GrantPermissionResponse

export async function usePermission<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: UsePermissionParameters<TModularSmartAccount>
): Promise<Hash> {
  const {
    account: nexusAccount = nexusClient.account,
    sessionDetailsArray,
    indexWithinChain: indexWithinChain_ = 0,
    nonce: nonce_,
    mode: mode_,
    ...rest
  } = parameters

  const chainId = nexusAccount?.client.chain?.id
  const publicClient = nexusAccount?.client as PublicClient
  const signer = nexusAccount?.signer
  const mode =
    mode_ === "ENABLE_AND_USE"
      ? SmartSessionMode.UNSAFE_ENABLE
      : SmartSessionMode.USE

  if (!chainId) {
    throw new Error("Chain ID is not set")
  }

  // find the all session details when chainId matches
  const sessionDetails_ = sessionDetailsArray.filter(
    (sessionDetails__) =>
      sessionDetails__.enableSessionData.enableSession.sessionToEnable
        .chainId === BigInt(chainId)
  )

  //sanity check
  if (sessionDetails_.length < indexWithinChain_ + 1) {
    throw new Error("Not enough sessions for the given index within chain")
  }

  const sessionDetails = {
    ...sessionDetails_[indexWithinChain_],
    mode
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

  const nonce =
    nonce_ ??
    // @ts-ignore
    (await nexusAccount.getNonce({ moduleAddress: SMART_SESSIONS_ADDRESS }))

  const userOperation = (await prepareUserOperation(nexusClient, {
    ...rest,
    signature: encodeSmartSessionSignature(sessionDetails),
    nonce
  } as AnyData)) as AnyData

  const userOpHashToSign = nexusAccount.getUserOpHash(userOperation)
  sessionDetails.signature = await signer.signMessage({
    message: { raw: userOpHashToSign }
  })

  userOperation.signature = encodeSmartSessionSignature(sessionDetails)
  return await sendUserOperation(nexusClient, userOperation)
}
