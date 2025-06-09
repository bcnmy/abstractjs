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

export type MultichainActionData = {
  actions: (ActionData & { chainId: number })[]
}

export type GrantMeePermissionParams<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = Prettify<
  MultichainActionData & {
    /** Granter Address */
    redeemer: Address
  } & { account?: TModularSmartAccount } & { feeToken: FeeTokenInfo }
>
export type GrantMeePermissionPayload = GrantPermissionResponse[]

export const grantMeePermission = async <
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  baseMeeClient: BaseMeeClient,
  {
    redeemer,
    actions,
    feeToken
  }: GrantMeePermissionParams<TModularSmartAccount>
): Promise<GrantMeePermissionPayload> => {
  const account = baseMeeClient.account
  const sessionDetails = await Promise.all(
    actions.map((action) => {
      const chainId = action.chainId
      const actionTarget = action.actionTarget
      const deployment = account.deployments.find(
        (deployment) => deployment?.client?.chain?.id === chainId
      )

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
        sessionValidatorInitData: redeemer, // initdata for the k1Mee validator is just the signer address
        permitERC4337Paymaster: true
      })
    })
  )
  return sessionDetails
}
