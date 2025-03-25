import {
  OWNABLE_VALIDATOR_ADDRESS,
  type Session,
  SmartSessionMode,
  encodeValidationData,
  getAccount,
  getEnableSessionDetails,
  getOwnableValidatorMockSignature
} from "@rhinestone/module-sdk"
import type { Address, Chain, Client, PublicClient, Transport } from "viem"
import { AccountNotFoundError } from "../../../../account/utils/AccountNotFound"
import { MEE_VALIDATOR_ADDRESS } from "../../../../constants"
import type { ModularSmartAccount } from "../../../utils/Types"
import { generateSalt, stringify } from "../Helpers"

export type GrantPermissionParameters<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = {
  /** Granter Address */
  redeemer: Address
  /** Actions */
  actions: Session["actions"]
} & { account?: TModularSmartAccount }

export type GrantPermissionResponse = string

export async function grantPermission<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: GrantPermissionParameters<TModularSmartAccount>
): Promise<string> {
  const {
    account: nexusAccount = nexusClient.account,
    redeemer,
    actions
  } = parameters
  const chainId = nexusAccount?.client.chain?.id
  const publicClient = nexusAccount?.client as PublicClient
  const signer = nexusAccount?.signer

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

  const session: Session = {
    sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
    permitERC4337Paymaster: false,
    sessionValidatorInitData: encodeValidationData({
      threshold: 1,
      owners: [redeemer]
    }),
    salt: generateSalt(),
    userOpPolicies: [],
    erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
    actions,
    chainId: BigInt(chainId)
  }

  const nexusAccountForRhinestone = getAccount({
    address: await nexusAccount.getAddress(),
    type: "nexus"
  })
  const sessionDetailsWithPermissionEnableHash = await getEnableSessionDetails({
    enableMode: SmartSessionMode.UNSAFE_ENABLE,
    sessions: [session],
    account: nexusAccountForRhinestone,
    clients: [publicClient],
    enableValidatorAddress: MEE_VALIDATOR_ADDRESS,
    ignoreSecurityAttestations: true
  })

  const { permissionEnableHash, ...sessionDetails } =
    sessionDetailsWithPermissionEnableHash

  if (!sessionDetails.enableSessionData?.enableSession.permissionEnableSig) {
    throw new Error("enableSessionData is undefined")
  }
  sessionDetails.enableSessionData.enableSession.permissionEnableSig =
    await signer.signMessage({ message: { raw: permissionEnableHash } })
  sessionDetails.signature = getOwnableValidatorMockSignature({ threshold: 1 })
  return stringify(sessionDetails)
}
