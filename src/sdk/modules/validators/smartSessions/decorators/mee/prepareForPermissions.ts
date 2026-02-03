import {
  type Address,
  type Hex,
  type OneOf,
  type PublicClient,
  decodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  getAbiItem,
  parseUnits,
  toFunctionSelector,
  zeroAddress
} from "viem"
import { build } from "../../../../../account/decorators/build"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import { toInstallWithSafeSenderCalls } from "../../../../../clients/decorators/erc7579/installModule"
import { isModuleInstalled } from "../../../../../clients/decorators/erc7579/isModuleInstalled"
import type {
  AbstractCall,
  ExecuteSignedQuotePayload,
  FeeTokenInfo,
  Instruction,
  SponsorshipOptionsParams,
  Trigger
} from "../../../../../clients/decorators/mee"
import { execute } from "../../../../../clients/decorators/mee/execute"
import { executeFusionQuote } from "../../../../../clients/decorators/mee/executeFusionQuote"
import type { GetFusionQuoteParams } from "../../../../../clients/decorators/mee/getFusionQuote"
import { getFusionQuote } from "../../../../../clients/decorators/mee/getFusionQuote"
import type {
  EIP7702AuthorizationParams,
  GetQuoteParams,
  InstructionLike
} from "../../../../../clients/decorators/mee/getQuote"
import {
  type AccountType,
  DEFAULT_MEE_VERSION,
  SMART_SESSIONS_ADDRESS,
  SPENDING_LIMITS_POLICY_ADDRESS,
  type Session,
  SmartSessionAbi,
  SmartSessionMode,
  getOwnableValidatorMockSignature,
  getPermissionId,
  getSpendingLimitsPolicy,
  getSudoPolicy
} from "../../../../../constants"
import { getMEEVersion } from "../../../../utils"
//import type { AnyData, ModularSmartAccount } from "../../../../utils/Types"
import type { AnyData } from "../../../../utils/Types"
import type { Validator } from "../../../toValidator"
import { generateSalt } from "../../Helpers"
import type { GrantPermissionResponse } from "../grantPermission"
import type { MultichainActionData } from "./grantMeePermission"

// omit instructions, feeToken and trigger to make them optional
export type PrepareForPermissionsParams = Omit<
  GetFusionQuoteParams,
  "instructions" | "feeToken" | "trigger"
> & {
  smartSessionsValidator: Validator
  additionalInstructions?: InstructionLike[]
  trigger?: Trigger
  maxPaymentAmount?: bigint
  redeemer?: Address
  actions?: MultichainActionData["actions"]
} & OneOf<
    | {
        /**
         * Token to be used for paying transaction fees
         */
        feeToken: FeeTokenInfo
      }
    | {
        /**
         * sponsorship flag to enable the sponsored super transactions.
         */
        sponsorship: true
        /**
         * Sponsorship options for overrides
         */
        sponsorshipOptions?: SponsorshipOptionsParams
      }
  > &
  EIP7702AuthorizationParams

/**
 * Returns undefined if there was no need to prepare the superTx
 */
export type PrepareForPermissionsPayload =
  | (ExecuteSignedQuotePayload & {
      sessionDetails?: GrantPermissionResponse
    })
  | undefined

export const prepareForPermissions = async (
  client: BaseMeeClient,
  parameters: PrepareForPermissionsParams
): Promise<PrepareForPermissionsPayload> => {
  const meeVersions = client.account.deployments.map(({ version, chain }) => ({
    chainId: chain.id,
    version
  }))

  // check if we need to install the module on any of the chains
  // it includes the deployment of the account on the chains if needed
  // because knowing the account is not deployed on a chain, means the module has not been installed on that chain
  // preparing the installation instruction means that when the instruction is going to be converted to the userOp,
  // the account will be deployed (userOp.initCode provided if needed)
  const installInstructions = await Promise.all(
    client.account.deployments.map(async (deployment) => {
      //sanity check
      const chainId = deployment.client.chain?.id

      if (!chainId) {
        throw new Error("Chain ID is not set")
      }

      const isModuleInstalled_ = (await deployment.isDeployed())
        ? await isModuleInstalled(undefined as AnyData, {
            account: deployment,
            module: {
              address: parameters.smartSessionsValidator.address,
              initData: "0x",
              type: parameters.smartSessionsValidator.type
            }
          })
        : false

      // it will also include the deployment instruction if needed
      if (!isModuleInstalled_) {
        return build(
          { accountAddress: client.account.signer.address, meeVersions },
          {
            type: "default",
            data: {
              calls: (await toInstallWithSafeSenderCalls(deployment, {
                address: parameters.smartSessionsValidator.address,
                initData: "0x",
                type: parameters.smartSessionsValidator.type
              })) as AbstractCall[],
              chainId,
              metadata: [
                {
                  type: "CUSTOM",
                  description: "Install smart sessions module",
                  chainId
                }
              ]
            }
          }
        )
      }
      return undefined
    })
  )

  const hasInstallInstructions = installInstructions.some(Boolean)

  const enableSessionsInstructions: Instruction[] = []
  const sessionDetailsArray: GrantPermissionResponse = []

  if (parameters.redeemer && parameters.actions) {
    const enableSessionsInstructionsWithSessionDetails =
      await prepareEnableSessions(client, parameters)

    for (const {
      instructions,
      sessionDetails
    } of enableSessionsInstructionsWithSessionDetails) {
      sessionDetailsArray.push(sessionDetails)
      enableSessionsInstructions.push(...instructions)
    }
  }

  const hasEnableSessionsInstructions = enableSessionsInstructions.length > 0

  if (
    hasInstallInstructions ||
    hasEnableSessionsInstructions ||
    parameters.additionalInstructions ||
    parameters.trigger
  ) {
    const cleanedInstallInstructions = installInstructions.filter(
      Boolean
    ) as InstructionLike[]

    let completeInstructionsList = parameters.additionalInstructions
      ? [...cleanedInstallInstructions, ...parameters.additionalInstructions]
      : cleanedInstallInstructions

    completeInstructionsList = hasEnableSessionsInstructions
      ? [...completeInstructionsList, ...enableSessionsInstructions]
      : completeInstructionsList

    // proceed to execute the superTx that
    // will deploy accounts/install modules and enable sessions

    // check if trigger is provided => use fusion flow
    if (parameters.trigger) {
      const quote = await getFusionQuote(client, {
        ...parameters,
        instructions: completeInstructionsList,
        batch: parameters.batch || true,
        trigger: parameters.trigger,
        simulation: parameters.simulation
      } as GetFusionQuoteParams)

      const { hash } = await executeFusionQuote(client, {
        fusionQuote: quote,
        companionAccount: client.account
      })

      return {
        hash,
        ...(sessionDetailsArray.length > 0
          ? { sessionDetails: sessionDetailsArray }
          : {})
      }
    }

    // otherwise use standard flow
    const { hash } = await execute(client, {
      ...parameters,
      instructions: completeInstructionsList,
      simulation: parameters.simulation
    } as GetQuoteParams)

    return {
      hash,
      ...(sessionDetailsArray.length > 0
        ? { sessionDetails: sessionDetailsArray }
        : {})
    }
  }

  return undefined
}

export const prepareEnableSessions = async (
  client: BaseMeeClient,
  parameters: PrepareForPermissionsParams
) => {
  const {
    feeToken,
    redeemer,
    maxPaymentAmount: maxPaymentAmount_,
    actions
  } = parameters

  const meeVersions = client.account.deployments.map(({ version, chain }) => ({
    chainId: chain.id,
    version
  }))

  if (!redeemer) {
    throw new Error("Smart session redeemer address is missing")
  }

  if (!actions || actions.length === 0) {
    throw new Error("Smart sessions actions are missing")
  }

  let maxPaymentAmount = maxPaymentAmount_ || 0n

  if (feeToken && !maxPaymentAmount_) {
    const { publicClient } = client.account.deploymentOn(feeToken.chainId, true)

    const decimals = await (publicClient as PublicClient).readContract({
      address: feeToken.address,
      abi: erc20Abi,
      functionName: "decimals"
    })

    maxPaymentAmount = parseUnits("5", decimals)
  }

  // This will be always true for MEE flows
  const permitERC4337Paymaster = true

  const uniqueChainIds = Array.from(
    new Set(actions.map((action) => action.chainId))
  )

  const enableSessionsInstructionsWithSessionDetails = await Promise.all(
    uniqueChainIds.map(async (chainId) => {
      const deployment = client.account.deployments.find(
        (deployment) => deployment.client.chain?.id === chainId
      )

      if (!deployment) {
        throw new Error(
          `Multichain Nexus is not configured on chain ${chainId}`
        )
      }

      let actionsForChain = actions.filter(
        (action) => action.chainId === chainId
      )

      if (feeToken && feeToken.chainId === chainId) {
        actionsForChain = addPaymentPolicyForActions(
          actionsForChain,
          feeToken,
          maxPaymentAmount
        )
      }

      const defaultVersionConfig = getMEEVersion(DEFAULT_MEE_VERSION)

      const meeValidatorAddress =
        deployment.version.validatorAddress ||
        defaultVersionConfig.validatorAddress

      const session: Session = {
        // MEE K1 validator is our session validator
        sessionValidator: meeValidatorAddress,
        // Initdata for the MEE K1 validator is just the signer address
        sessionValidatorInitData: redeemer,
        salt: generateSalt(),
        userOpPolicies: permitERC4337Paymaster ? [getSudoPolicy()] : [],
        erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
        actions: actionsForChain,
        permitERC4337Paymaster,
        chainId: BigInt(chainId)
      }

      const enableSessionsData = encodeFunctionData({
        abi: SmartSessionAbi,
        functionName: "enableSessions",
        args: [[session]]
      })

      const sessionDetailsSignature = getOwnableValidatorMockSignature({
        threshold: 1
      })

      const permissionId = getPermissionId({
        session: session
      })

      const instructions = await build(
        { accountAddress: client.account.signer.address, meeVersions },
        {
          type: "default",
          data: {
            calls: [
              {
                to: SMART_SESSIONS_ADDRESS,
                data: enableSessionsData
              }
            ] as AbstractCall[],
            chainId,
            metadata: [
              {
                type: "CUSTOM",
                description: "Enable smart sessions permissions",
                chainId
              }
            ]
          }
        }
      )

      return {
        instructions,
        sessionDetails: {
          // This will be always use mode
          mode: SmartSessionMode.USE,
          permissionId,
          signature: sessionDetailsSignature,
          // This is just a dummy enableSessionData with zero values to be compatible with rest of the codebase
          // However this will be completely ignored if USE mode is used
          enableSessionData: {
            enableSession: {
              chainDigestIndex: 0,
              hashesAndChainIds: [
                {
                  chainId: session.chainId,
                  sessionDigest: "0x" as Hex
                }
              ],
              sessionToEnable: session,
              permissionEnableSig: "0x" as Hex
            },
            validator: zeroAddress,
            accountType: "nexus" as AccountType
          }
        }
      }
    })
  )

  return enableSessionsInstructionsWithSessionDetails
}

export const addPaymentPolicyForActions = (
  actionsForChain: MultichainActionData["actions"],
  feeToken: FeeTokenInfo,
  maxPaymentAmount: bigint
): MultichainActionData["actions"] => {
  const transferSelector = toFunctionSelector(
    getAbiItem({ abi: erc20Abi, name: "transfer" })
  )

  const updatedActionsForChain = actionsForChain.map((action) => {
    if (
      action.actionTargetSelector.toLowerCase() ===
        transferSelector.toLowerCase() &&
      action.actionTarget.toLowerCase() === feeToken.address.toLowerCase()
    ) {
      const updatedActionPolicies = action.actionPolicies.map(
        (actionPolicy) => {
          if (
            actionPolicy.policy.toLowerCase() ===
            SPENDING_LIMITS_POLICY_ADDRESS.toLowerCase()
          ) {
            const [tokens, limits] = decodeAbiParameters(
              [{ type: "address[]" }, { type: "uint256[]" }],
              actionPolicy.initData
            )

            const updatedTokensAndLimits: {
              limit: bigint
              token: Address
            }[] = []

            for (let index = 0; index < tokens.length; index++) {
              const token = tokens[index]
              const limit = limits[index]

              if (token.toLowerCase() === feeToken.address.toLowerCase()) {
                updatedTokensAndLimits.push({
                  token,
                  limit: limit + maxPaymentAmount
                })
              } else {
                updatedTokensAndLimits.push({ token, limit })
              }
            }

            return getSpendingLimitsPolicy(updatedTokensAndLimits)
          }

          return actionPolicy
        }
      )

      return { ...action, actionPolicies: updatedActionPolicies }
    }

    return action
  })

  const isPolicyForPaymentTokenExists = updatedActionsForChain.some(
    (action) =>
      action.actionTargetSelector.toLowerCase() ===
        transferSelector.toLowerCase() &&
      action.actionTarget.toLowerCase() === feeToken.address.toLowerCase()
  )

  if (!isPolicyForPaymentTokenExists) {
    const paymentAction = {
      actionTarget: feeToken.address,
      actionTargetSelector: transferSelector,
      actionPolicies: [
        getSpendingLimitsPolicy([
          { limit: maxPaymentAmount, token: feeToken.address }
        ])
      ],
      chainId: feeToken.chainId
    }

    updatedActionsForChain.push(paymentAction)
  }

  return updatedActionsForChain
}
