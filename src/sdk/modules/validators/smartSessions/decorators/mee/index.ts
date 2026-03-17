import type { PublicClient } from "viem"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import { SMART_SESSIONS_ADDRESS } from "../../../../../constants"
import type { ModularSmartAccount } from "../../../../utils/Types"
import {
  type GrantMeePermissionParams,
  type GrantMeePermissionPayload,
  grantMeePermissionPersonalSign,
  grantMeePermissionTypedDataSign
} from "./grantMeePermission"
import {
  type PrepareForPermissionsParams,
  type PrepareForPermissionsPayload,
  prepareForPermissions
} from "./prepareForPermissions"
import {
  type UseMeePermissionParams,
  type UseMeePermissionPayload,
  useMeePermission
} from "./useMeePermission"

/**
 * Collection of MEE (Multi-chain Execution Environment) actions for transaction handling
 */
export type MeeSessionActions = {
  prepareForPermissions: (
    params: PrepareForPermissionsParams
  ) => Promise<PrepareForPermissionsPayload>
  grantPermissionPersonalSign: <
    TModularSmartAccount extends ModularSmartAccount | undefined
  >(
    params: GrantMeePermissionParams<TModularSmartAccount>
  ) => Promise<GrantMeePermissionPayload>
  grantPermissionTypedDataSign: <
    TModularSmartAccount extends ModularSmartAccount | undefined
  >(
    params: GrantMeePermissionParams<TModularSmartAccount>
  ) => Promise<GrantMeePermissionPayload>
  usePermission: (
    params: UseMeePermissionParams
  ) => Promise<UseMeePermissionPayload>
  isPermissionEnabled: (params: IsPermissionEnabledParams) => Promise<boolean>
  checkEnabledPermissions: (
    params: GrantMeePermissionPayload
  ) => Promise<CheckEnabledPermissionsPayload>
}

/**
 * Creates an instance of MEE actions using the provided client
 * @param meeClient - Base MEE client instance
 * @returns Object containing all MEE actions
 */
export const meeSessionActions = (
  meeClient: BaseMeeClient
): MeeSessionActions => {
  return {
    prepareForPermissions: (params: PrepareForPermissionsParams) =>
      prepareForPermissions(meeClient, params),
    grantPermissionPersonalSign: (
      params: GrantMeePermissionParams<ModularSmartAccount>
    ) => grantMeePermissionPersonalSign(meeClient, params),
    grantPermissionTypedDataSign: (
      params: GrantMeePermissionParams<ModularSmartAccount>
    ) => grantMeePermissionTypedDataSign(meeClient, params),
    usePermission: (params: UseMeePermissionParams) =>
      useMeePermission(meeClient, params),
    isPermissionEnabled: (params: IsPermissionEnabledParams) =>
      isPermissionEnabled(meeClient, params),
    checkEnabledPermissions: (params: GrantMeePermissionPayload) =>
      checkEnabledPermissions(meeClient, params)
  }
}

export {
  grantMeePermissionPersonalSign,
  grantMeePermissionTypedDataSign
} from "./grantMeePermission"
export { useMeePermission } from "./useMeePermission"
export { prepareForPermissions } from "./prepareForPermissions"

/**
 * Input parameters for the isPermissionEnabled function
 * @param permissionId - The permission ID to check
 * @param chainId - The chain ID to check the permission on
 */
export type IsPermissionEnabledParams = {
  permissionId: `0x${string}`
  chainId: number
}

/**
 * Checks if a permission is enabled for a given chain for this MEE client
 * assumes the PermissionId is known
 * @param meeClient - The MEE client
 * @param params - The parameters for the isPermissionEnabled function
 * @returns The result of the call to SmartSessions.isPermissionEnabled function
 */
export const isPermissionEnabled = async (
  meeClient: BaseMeeClient,
  params: IsPermissionEnabledParams
): Promise<boolean> => {
  const deployment = meeClient.account.deploymentOn(params.chainId, true)
  const chainClient = deployment.client as PublicClient
  return await chainClient.readContract({
    address: SMART_SESSIONS_ADDRESS,
    abi: [
      {
        inputs: [
          {
            name: "permissionId",
            type: "bytes32",
            internalType: "PermissionId"
          },
          { name: "account", type: "address", internalType: "address" }
        ],
        name: "isPermissionEnabled",
        outputs: [{ name: "", type: "bool", internalType: "bool" }],
        stateMutability: "view",
        type: "function"
      }
    ],
    functionName: "isPermissionEnabled",
    args: [params.permissionId, deployment.address]
  })
}

/**
 * Output payload for the checkEnabledPermission function
 * It is a mapping of permissionId => chainId => isEnabled
 */
export type CheckEnabledPermissionsPayload = {
  [permissionId: `0x${string}`]: {
    [chainId: number]: boolean
  }
}

/**
 * For all the permissions from the grantMeePermissionPayload,
 * checks if they are enabled or not.
 * Facilitates checking the whole return object of the grantMeePermission function.
 * So the developer doesn't need to parse and know permissionId(s) for each chain.
 * Detects the permissions that were expected to be enabled on each chain
 * and checks if they are enabled or not.
 * @param meeClient - The MEE client
 * @param params - The return data of the grantMeePermission function
 * @returns A mapping of permissionId => chainId => isEnabled
 */
export const checkEnabledPermissions = async (
  meeClient: BaseMeeClient,
  params: GrantMeePermissionPayload
): Promise<CheckEnabledPermissionsPayload> => {
  const enabledPermissions = await Promise.all(
    params.map(async (permission) => {
      const chainId = Number(
        permission.enableSessionData.enableSession.sessionToEnable.chainId
      )
      return {
        permissionId: permission.permissionId,
        chainId,
        enabled: await isPermissionEnabled(meeClient, {
          permissionId: permission.permissionId,
          chainId
        })
      }
    })
  )
  return enabledPermissions.reduce((acc, permission) => {
    acc[permission.permissionId] = {
      [permission.chainId]: permission.enabled
    }
    return acc
  }, {} as CheckEnabledPermissionsPayload)
}
