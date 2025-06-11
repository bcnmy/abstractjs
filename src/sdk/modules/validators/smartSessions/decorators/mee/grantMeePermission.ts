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

/**
 * no feeToken should be provided for the sponsored mode
 */
export type GrantMeePermissionParams<
  TModularSmartAccount extends ModularSmartAccount | undefined
> = Prettify<
  MultichainActionData & {
    /** Granter Address */
    redeemer: Address
  } & { account?: TModularSmartAccount } & { feeToken?: FeeTokenInfo }
>
export type GrantMeePermissionPayload = GrantPermissionResponse[]

/**
 * Grants a permission to the redeemer for the actions
 * Automatically adds the payment action policy if a fee token is provided
 * If the superTxn is sponsored, the payment action policy is not added
 * as it is not needed for the sponsored mode
 * If the superTxn is not sponsored, the payment action policy is added
 *
 * Attention: actions for the cleanup userOps are not added automatically
 * and should be provided explicitly in the actions array
 *
 * @param baseMeeClient - The base MeeClient
 * @param params - The parameters for the grantMeePermission function
 * @returns The session details
 */
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

      // if no fee token is provided, the payment action policy is not added
      // as it is not needed for the sponsored mode
      const paymentActionPolicy =
        feeToken && feeToken.chainId === chainId
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
