import type { Address, Prettify } from "viem"
import type { MultichainAddressMapping } from "../../../../../account/decorators/buildBridgeInstructions"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import type { ActionData } from "../../../../../constants"
import type { AnyData, ModularSmartAccount } from "../../../../utils/Types"
import {
  type GrantPermissionResponse,
  grantPermission
} from "../grantPermission"

export type RequiredSessionParamsWithNoTarget = {
  actions: Omit<ActionData, "actionTarget">[]
}

export type GrantMeePermissionParams<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = Prettify<
  RequiredSessionParamsWithNoTarget & {
    /** Granter Address */
    redeemer: Address
    /** Address mapping of the contract to interact with per chain */
    addressMapping: MultichainAddressMapping
  } & { account?: TModularSmartAccount }
>
export type GrantMeePermissionPayload = GrantPermissionResponse[]

export const grantMeePermission = async <
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  baseMeeClient: BaseMeeClient,
  {
    addressMapping,
    redeemer,
    actions
  }: GrantMeePermissionParams<TModularSmartAccount>
): Promise<GrantMeePermissionPayload> => {
  const account = baseMeeClient.account
  const sessionDetails = await Promise.all(
    account.deployments.map((deployment) => {
      const actionTarget = addressMapping.on(
        deployment?.client?.chain?.id as number
      )
      if (!actionTarget) {
        throw new Error(
          `No contract address found for chain ${deployment?.client?.chain?.id}`
        )
      }
      return grantPermission(undefined as AnyData, {
        account: deployment,
        redeemer,
        actions: actions.map((action) => ({ ...action, actionTarget }))
      })
    })
  )
  return sessionDetails
}
