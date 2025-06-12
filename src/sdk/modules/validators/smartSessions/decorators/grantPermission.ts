import {
  type ActionData,
  type ERC7739Data,
  OWNABLE_VALIDATOR_ADDRESS,
  type PolicyData,
  type Session,
  SmartSessionMode,
  encodeValidationData,
  getAccount,
  getEnableSessionDetails,
  getOwnableValidatorMockSignature,
  getSudoPolicy
} from "@rhinestone/module-sdk"
import {
  type Address,
  type Chain,
  type Client,
  type Hex,
  type Prettify,
  type PublicClient,
  type RequiredBy,
  type Transport,
  zeroAddress
} from "viem"
import { AccountNotFoundError } from "../../../../account/utils/AccountNotFound"
import type { ModularSmartAccount } from "../../../utils/Types"
import { generateSalt } from "../Helpers"

export type PrettifiedSession = {
  // The optional address of the validator that will be used to validate the session. Default is the ownable validator.
  sessionValidator?: Address
  // The optional init data for the validator. Default is the ownable validator. Can be constructed using the encodeValidationData function.
  sessionValidatorInitData?: Hex
  // The optional salt for a unique session.
  salt?: Hex
  // Whether the session will use a paymaster.
  permitERC4337Paymaster?: boolean
  // The actions that will be performed by the session.
  actions: ActionData[]
  // The chain ID of the session. Can be omitted if the account is deployed on multiple chains.
  chainId?: bigint
  // The user op policies that will be used by the session. These apply to the user operation as a whole.
  userOpPolicies?: PolicyData[]
  // The erc7739 policies that will be used by the session.
  erc7739Policies?: ERC7739Data
}

export type RequiredSessionParams = RequiredBy<
  Partial<PrettifiedSession>,
  "actions"
>

export type GrantPermissionParameters<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = Prettify<
  Partial<PrettifiedSession> &
    RequiredSessionParams & {
      /** Granter Address */
      redeemer: Address
    } & { account?: TModularSmartAccount }
>

// The session details in stringified format.
export type GrantPermissionResponse = Prettify<
  Omit<
    Awaited<ReturnType<typeof getEnableSessionDetails>>,
    "permissionEnableHash"
  >
>

export async function grantPermission<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: GrantPermissionParameters<TModularSmartAccount>
): Promise<GrantPermissionResponse> {
  const {
    account: nexusAccount = nexusClient.account,
    redeemer,
    chainId: bigChainId,
    ...session_
  } = parameters
  const publicClient = nexusAccount?.client as PublicClient
  const signer = nexusAccount?.signer
  const chainIdFromAccount = nexusAccount?.client?.chain?.id
  if (!chainIdFromAccount) {
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
    userOpPolicies: session_?.permitERC4337Paymaster ? [getSudoPolicy()] : [],
    erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
    chainId: bigChainId ?? BigInt(chainIdFromAccount),
    ...session_
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
    enableValidatorAddress: zeroAddress, // default validator
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
  return sessionDetails
}
