import type { Chain, Client, Hash, Transport } from "viem"
import type { ModularSmartAccount } from "../../../../modules/utils/Types"
import {
  type GrantPermissionParameters,
  type GrantPermissionResponse,
  grantPermissionPersonalSign,
  grantPermissionTypedDataSign
} from "./grantPermission"
import { type UsePermissionParameters, usePermission } from "./usePermission"

/**
 * Defines the shape of actions available for creating smart sessions.
 *
 * @template TModularSmartAccount - Type of the modular smart account, extending ModularSmartAccount or undefined.
 */
export type SmartSessionActions<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = {
  /**
   * Creates multiple sessions for a modular smart account. This differs from usePermission in that it
   * grants the permission on chain immediately. It is also known as "USE_MODE", and it means that the permission
   * is granted on chain immediately, and the permission is later redeemed when the user operation is sent.
   *
   * @param args - Parameters for creating sessions.
   * @returns A promise that resolves to the creation response.
   */
  grantPermissionPersonalSign: (
    args: GrantPermissionParameters<TModularSmartAccount>
  ) => Promise<GrantPermissionResponse>

  /**
   * Grants a permission with typed data sign.
   *
   * @param args - Parameters for granting a permission.
   * @returns A promise that resolves to the grant permission response.
   */
  grantPermissionTypedDataSign: (
    args: GrantPermissionParameters<TModularSmartAccount>
  ) => Promise<GrantPermissionResponse>

  /**
   * Uses a session to perform an action.
   *
   * @param args - Parameters for using a session.
   * @returns A promise that resolves to the transaction hash.
   */
  usePermission: (
    args: UsePermissionParameters<TModularSmartAccount>
  ) => Promise<Hash>
}

/**
 * Creates actions for managing smart session creation.
 *
 * @param _ - Unused parameter (placeholder for potential future use).
 * @returns A function that takes a client and returns SmartSessionActions.
 */
export function smartSessionActions() {
  return <TModularSmartAccount extends ModularSmartAccount | undefined>(
    client: Client<Transport, Chain | undefined, TModularSmartAccount>
  ): SmartSessionActions<TModularSmartAccount> => ({
    usePermission: (args) => usePermission(client, args),
    grantPermissionPersonalSign: (args) =>
      grantPermissionPersonalSign(client, args),
    grantPermissionTypedDataSign: (args) =>
      grantPermissionTypedDataSign(client, args)
  })
}

export {
  usePermission,
  grantPermissionPersonalSign,
  grantPermissionTypedDataSign
}
export {
  meeSessionActions,
  grantMeePermissionPersonalSign,
  grantMeePermissionTypedDataSign,
  useMeePermission
} from "./mee"
