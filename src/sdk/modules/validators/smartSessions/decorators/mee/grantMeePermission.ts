import type { Address, Prettify, PublicClient } from "viem"
import { erc20Abi, parseUnits } from "viem"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import type { FeeTokenInfo } from "../../../../../clients/decorators/mee"
import {
  type ActionData,
  DEFAULT_MEE_VERSION,
  getSpendingLimitsPolicy
} from "../../../../../constants"

import type { MEEVersionConfig } from "../../../../../account"
import type { AnyData, ModularSmartAccount } from "../../../../utils/Types"
import { getMEEVersion } from "../../../../utils/getMeeConfig"
import {
  type GrantPermissionResponse,
  grantPermissionPersonalSign,
  grantPermissionTypedDataSign
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
  } & { account?: TModularSmartAccount } & { feeToken?: FeeTokenInfo } & {
    maxPaymentAmount?: bigint
  }
>
export type GrantMeePermissionPayload = GrantPermissionResponse

export const grantMeePermissionPersonalSign = async <
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  baseMeeClient: BaseMeeClient,
  params: GrantMeePermissionParams<TModularSmartAccount>
) => {
  return grantMeePermission(baseMeeClient, params, "PERSONAL_SIGN")
}

export const grantMeePermissionTypedDataSign = async <
  TModularSmartAccount extends ModularSmartAccount | undefined
>(
  baseMeeClient: BaseMeeClient,
  params: GrantMeePermissionParams<TModularSmartAccount>
) => {
  return grantMeePermission(baseMeeClient, params, "TYPED_DATA_SIGN")
}

/**
 * Grants a permission to the redeemer for the actions
 * Automatically adds the payment action policy if a fee token is provided
 * If the superTxn is sponsored, the payment action policy is not added
 * as it is not needed for the sponsored mode
 * If the superTxn is not sponsored, the payment action policy is added
 *
 * @alert Attention: Smart Session actions for the cleanup userOps are not added automatically
 * to the session, and should be provided explicitly in the actions array
 *
 * @alert Despite the fact smart sessions module supports it, please,
 * avoid granting several permissions for the same chain within single `grantMeePermission` usage.
 * Because later you will only be able to enable and use one permission per chain.
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
    feeToken,
    maxPaymentAmount,
    account: _account
  }: GrantMeePermissionParams<TModularSmartAccount>,
  mode: "PERSONAL_SIGN" | "TYPED_DATA_SIGN"
): Promise<GrantMeePermissionPayload> => {
  const account = baseMeeClient.account

  // make some reliable maxPaymentAmount
  if (feeToken && !maxPaymentAmount) {
    const deploymentOnPaymentChain = baseMeeClient.account.deploymentOn(
      feeToken.chainId,
      true
    )
    const paymentChainpublicClient =
      deploymentOnPaymentChain.client as PublicClient
    // get decimals of the fee token
    const decimals = await paymentChainpublicClient.readContract({
      address: feeToken.address,
      abi: erc20Abi,
      functionName: "decimals"
    })
    // set proper maxPaymentAmount with proper decimals
    maxPaymentAmount = parseUnits("5", decimals)
  }

  const grantPermissionParameters = actions.map((action) => {
    const chainId = action.chainId
    const actionTarget = action.actionTarget
    const deployment = account.deployments.find(
      (deployment) => deployment?.client?.chain?.id === chainId
    )

    const defaultVersionConfig: MEEVersionConfig =
      getMEEVersion(DEFAULT_MEE_VERSION)
    const meeValidatorAddress =
      deployment?.version.validatorAddress ||
      defaultVersionConfig.validatorAddress

    const paymentActionPolicy =
      feeToken && feeToken.chainId === chainId
        ? {
            actionTarget: feeToken.address,
            actionTargetSelector: "0xa9059cbb" as Address, // transfer
            actionPolicies: [
              getPolicyForPayment(maxPaymentAmount!, feeToken.address)
            ]
          }
        : undefined

    return {
      account: deployment,
      redeemer,
      actions: [
        ...actions.map((action) => ({ ...action, actionTarget })),
        ...(paymentActionPolicy ? [paymentActionPolicy] : [])
      ],
      sessionValidator: meeValidatorAddress,
      sessionValidatorInitData: redeemer, // initdata for the k1Mee validator is just the signer address
      permitERC4337Paymaster: true
    }
  })

  return mode === "PERSONAL_SIGN"
    ? grantPermissionPersonalSign(
        undefined as AnyData,
        grantPermissionParameters
      )
    : grantPermissionTypedDataSign(
        undefined as AnyData,
        grantPermissionParameters
      )
}

const getPolicyForPayment = (maxPaymentAmount: bigint, token: Address) => {
  return getSpendingLimitsPolicy([{ limit: maxPaymentAmount, token }])
}
