import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import type { ModularSmartAccount } from "../../../../utils/Types"
import {
  type GrantMeePermissionParams,
  type GrantMeePermissionPayload,
  grantMeePermission
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
  grantPermission: <
    TModularSmartAccount extends ModularSmartAccount | undefined
  >(
    params: GrantMeePermissionParams<TModularSmartAccount>
  ) => Promise<GrantMeePermissionPayload>
  usePermission: (
    params: UseMeePermissionParams
  ) => Promise<UseMeePermissionPayload>
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
    grantPermission: (params: GrantMeePermissionParams<ModularSmartAccount>) =>
      grantMeePermission(meeClient, params),
    usePermission: (params: UseMeePermissionParams) =>
      useMeePermission(meeClient, params)
  }
}

export { grantMeePermission } from "./grantMeePermission"
export { useMeePermission } from "./useMeePermission"
export { prepareForPermissions } from "./prepareForPermissions"
