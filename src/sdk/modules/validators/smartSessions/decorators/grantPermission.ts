import {
  type Account,
  type ActionData,
  type ChainSession,
  type ERC7739Data,
  GLOBAL_CONSTANTS,
  OWNABLE_VALIDATOR_ADDRESS,
  type PolicyData,
  type Session,
  SmartSessionMode,
  encodeValidationData,
  getAccount,
  getEnableSessionDetails,
  getOwnableValidatorMockSignature,
  getPermissionId,
  getSessionDigest,
  getSessionNonce,
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

export type GrantPermissionParameterEntry<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = Prettify<
  Partial<PrettifiedSession> &
    RequiredSessionParams & {
      /** Granter Address */
      redeemer: Address
    } & { account?: TModularSmartAccount }
>

export type GrantPermissionParameters<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = GrantPermissionParameterEntry<TModularSmartAccount>[]

// The session details in stringified format.
export type GrantPermissionResponse = Prettify<
  Omit<
    Awaited<ReturnType<typeof getEnableSessionDetails>>,
    "permissionEnableHash"
  >
>[]

export async function grantPermissionPersonalSign<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: GrantPermissionParameters<TModularSmartAccount>
): Promise<GrantPermissionResponse> {
  const { sessions, accountsAndChainIds, clients, signer } =
    await prepareForGrantingPermission(nexusClient, parameters)

  // re-implement getEnableSessionDetails so it takes an array nexusAccountsForRhinestone
  // and uses one account for every chain coz it can have different address for every chain
  // but we sign only once
  // so the sessionDetails object is just modified for all the chains: to have different:
  // - session to enable
  // - chain digest index

  const sessionDetailsWithPermissionEnableHash = await getEnableSessionDetails({
    enableMode: SmartSessionMode.UNSAFE_ENABLE,
    sessions,
    account: accountsAndChainIds[0].account,
    clients,
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

/**
 * Grants the permission signed with typed data signature
 * @param nexusClient
 * @param parameters
 * @returns
 */

export async function grantPermissionTypedDataSign<
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: GrantPermissionParameters<TModularSmartAccount>
): Promise<GrantPermissionResponse> {
  const { sessions, accountsAndChainIds, clients, signer } =
    await prepareForGrantingPermission(nexusClient, parameters)

  // keeping this algorithm with `for` loop
  // because we are going to use multiple sessions in the future
  //const sessions = [session]
  //const clients = [publicClient]

  const chainDigests: { chainId: bigint; sessionDigest: any }[] = []
  const chainSessions: ChainSession[] = []
  for (const session of sessions) {
    const permissionId = getPermissionId({
      session
    })

    const client = clients.find(
      (c) => BigInt(c.chain?.id ?? 0) === session.chainId
    )

    if (!client) {
      throw new Error(`Client not found for chainId ${session.chainId}`)
    }

    const account = accountsAndChainIds.find(
      (a) => a.chainId === session.chainId
    )?.account

    if (!account) {
      throw new Error(`Account not found for chainId ${session.chainId}`)
    }

    const sessionNonce = await getSessionNonce({
      client,
      account,
      permissionId
    })

    const sessionDigest = await getSessionDigest({
      client,
      account,
      session,
      mode: SmartSessionMode.UNSAFE_ENABLE,
      permissionId
    })

    chainDigests.push({
      chainId: session.chainId,
      sessionDigest
    })

    chainSessions.push({
      chainId: session.chainId,
      session: {
        ...session,
        permissions: {
          permitGenericPolicy: false,
          permitAdminAccess: false,
          ignoreSecurityAttestations: true,
          permitERC4337Paymaster: session.permitERC4337Paymaster,
          userOpPolicies: session.userOpPolicies,
          erc7739Policies: session.erc7739Policies,
          actions: session.actions
        },
        account: account.address,
        smartSession: GLOBAL_CONSTANTS.SMART_SESSIONS_ADDRESS,
        nonce: sessionNonce
      }
    })
  }

  const permissionEnableSig = await signer.signTypedData({
    domain: {
      name: "SmartSession",
      version: "1"
    },
    types: {
      PolicyData: [
        { name: "policy", type: "address" },
        { name: "initData", type: "bytes" }
      ],
      ActionData: [
        { name: "actionTargetSelector", type: "bytes4" },
        { name: "actionTarget", type: "address" },
        { name: "actionPolicies", type: "PolicyData[]" }
      ],
      ERC7739Context: [
        { name: "appDomainSeparator", type: "bytes32" },
        { name: "contentName", type: "string[]" }
      ],
      ERC7739Data: [
        { name: "allowedERC7739Content", type: "ERC7739Context[]" },
        { name: "erc1271Policies", type: "PolicyData[]" }
      ],
      SignedPermissions: [
        { name: "permitGenericPolicy", type: "bool" },
        { name: "permitAdminAccess", type: "bool" },
        { name: "ignoreSecurityAttestations", type: "bool" },
        { name: "permitERC4337Paymaster", type: "bool" },
        { name: "userOpPolicies", type: "PolicyData[]" },
        { name: "erc7739Policies", type: "ERC7739Data" },
        { name: "actions", type: "ActionData[]" }
      ],
      SignedSession: [
        { name: "account", type: "address" },
        { name: "permissions", type: "SignedPermissions" },
        { name: "sessionValidator", type: "address" },
        { name: "sessionValidatorInitData", type: "bytes" },
        { name: "salt", type: "bytes32" },
        { name: "smartSession", type: "address" },
        { name: "nonce", type: "uint256" }
      ],
      ChainSession: [
        { name: "chainId", type: "uint64" },
        { name: "session", type: "SignedSession" }
      ],
      MultiChainSession: [
        { name: "sessionsAndChainIds", type: "ChainSession[]" }
      ]
    },
    primaryType: "MultiChainSession",
    message: {
      sessionsAndChainIds: chainSessions
    }
  })

  const sessionDetailsSignature = getOwnableValidatorMockSignature({
    threshold: 1
  })

  const sessionDetailsArray = sessions.map((session) => {
    const permissionId = getPermissionId({
      session: session
    })

    const sessionIndex = sessions.indexOf(session)

    const accountType =
      accountsAndChainIds.find((a) => a.chainId === session.chainId)?.account
        .type ?? "nexus"

    return {
      mode: SmartSessionMode.UNSAFE_ENABLE,
      permissionId,
      signature: sessionDetailsSignature,
      enableSessionData: {
        enableSession: {
          chainDigestIndex: sessionIndex,
          hashesAndChainIds: chainDigests,
          sessionToEnable: session,
          permissionEnableSig: permissionEnableSig
        },
        validator: zeroAddress, // default validator
        accountType
      }
    }
  })

  return sessionDetailsArray
}

export type PrepareForGrantingPermissionResponse = {
  sessions: Session[]
  accountsAndChainIds: AccountAndChainId[]
  clients: PublicClient[]
  signer: any
}

export type AccountAndChainId = {
  account: Account
  chainId: bigint
}

const prepareForGrantingPermission = async <
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  nexusClient: Client<Transport, Chain | undefined, TModularSmartAccount>,
  parameters: GrantPermissionParameters<TModularSmartAccount>
): Promise<PrepareForGrantingPermissionResponse> => {
  const sessions: Session[] = []
  const accountsAndChainIds: AccountAndChainId[] = []
  const publicClients: PublicClient[] = []
  const signer = nexusClient.account?.signer || parameters[0].account?.signer
  if (!signer) {
    throw new Error("Signer is not set")
  }

  for (const parameterEntry of parameters) {
    const {
      account: nexusAccount = nexusClient.account,
      redeemer,
      chainId: bigChainId,
      ...session_
    } = parameterEntry
    const publicClient = nexusAccount?.client as PublicClient
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

    const accountAndChainId: AccountAndChainId = {
      account: getAccount({
        address: await nexusAccount.getAddress(),
        type: "nexus"
      }),
      chainId: bigChainId ?? BigInt(chainIdFromAccount)
    }

    sessions.push(session)
    accountsAndChainIds.push(accountAndChainId)
    publicClients.push(publicClient)
  }

  return {
    sessions,
    accountsAndChainIds,
    clients: publicClients,
    signer
  }
}
