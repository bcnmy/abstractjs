import type { Address, Prettify } from "viem"
import type { MultichainAddressMapping } from "../../../../../account/decorators/buildBridgeInstructions"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import type { FeeTokenInfo } from "../../../../../clients/decorators/mee"
import {
  type ActionData,
  MEE_VALIDATOR_ADDRESS,
  getSudoPolicy
} from "../../../../../constants"
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
  } & { account?: TModularSmartAccount } & { feeToken: FeeTokenInfo }
>
export type GrantMeePermissionPayload = GrantPermissionResponse[]

export const grantMeePermission = async <
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  baseMeeClient: BaseMeeClient,
  {
    addressMapping,
    redeemer,
    actions,
    feeToken
  }: GrantMeePermissionParams<TModularSmartAccount>
): Promise<GrantMeePermissionPayload> => {
  const account = baseMeeClient.account
  const sessionDetails = await Promise.all(
    account.deployments.map((deployment) => {
      const chainId = deployment?.client?.chain?.id as number
      const actionTarget = addressMapping.on(chainId)
      if (!actionTarget) {
        throw new Error(`No contract address found for chain ${chainId}`)
      }
      const paymentActionPolicy =
        feeToken.chainId === chainId
          ? {
              actionTarget: feeToken.address,
              actionTargetSelector: "0xa9059cbb" as Address, // transfer
              actionPolicies: [getSudoPolicy()]
            }
          : undefined
      return grantPermission(undefined as AnyData, {
        account: deployment,
        redeemer,
        actions: [
          ...actions.map((action) => ({ ...action, actionTarget })),
          ...(paymentActionPolicy ? [paymentActionPolicy] : [])
        ],
        sessionValidator: MEE_VALIDATOR_ADDRESS,
        permitERC4337Paymaster: true
      })
    })
  )
  return sessionDetails
}
