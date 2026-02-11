import {
  type Address,
  type Hex,
  type OneOf,
  type PublicClient,
  decodeAbiParameters,
  encodeAbiParameters,
  erc20Abi,
  getAbiItem,
  getAddress,
  keccak256,
  parseAbiParameters,
  parseUnits,
  toFunctionSelector,
  zeroAddress
} from "viem"
import {
  batchInstructions,
  resolveInstructions,
  toBytes32
} from "../../../../../account"
import type { SessionAction } from "../../../../../account/decorators/buildAction"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import { toInstallWithSafeSenderCalls } from "../../../../../clients/decorators/erc7579/installModule"
import { isModuleInstalled } from "../../../../../clients/decorators/erc7579/isModuleInstalled"
import { parseModuleTypeId } from "../../../../../clients/decorators/erc7579/supportsModule"
import type {
  CustomOverride,
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
  type ActionData,
  DEFAULT_MEE_VERSION,
  NexusImplementationAbi,
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
import {
  ConditionType,
  createCondition,
  getMEEVersion
} from "../../../../utils"
import type { AnyData } from "../../../../utils/Types"
import type { Validator } from "../../../toValidator"
import { generateSalt } from "../../Helpers"
import type { GrantPermissionResponse } from "../grantPermission"

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
  actions?: SessionAction[]
  batchActions?: boolean
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
  const {
    // By default, actions are batched
    batchActions = true
  } = parameters

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
        const installModuleCalls = await toInstallWithSafeSenderCalls(
          deployment,
          {
            address: parameters.smartSessionsValidator.address,
            initData: "0x",
            type: parameters.smartSessionsValidator.type
          }
        )

        const installModuleInstructions: Instruction[] = []

        for (const installModuleCall of installModuleCalls) {
          const instruction = await client.account.buildComposable({
            type: "rawCalldata",
            data: {
              to: installModuleCall.to,
              calldata: installModuleCall.data!,
              value: installModuleCall.value,
              chainId,
              metadata: [
                {
                  type: "CUSTOM",
                  description: "Install smart sessions module",
                  chainId
                }
              ]
            }
          })

          installModuleInstructions.push(...instruction)
        }

        return await client.account.buildComposable({
          type: "batch",
          data: {
            instructions: installModuleInstructions
          }
        })
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
    const validInstallInstructions = installInstructions.filter(
      Boolean
    ) as InstructionLike[]

    const unresolvedInstructions = parameters.additionalInstructions
      ? [...validInstallInstructions, ...parameters.additionalInstructions]
      : validInstallInstructions

    const resolvedInstructions = await resolveInstructions(
      unresolvedInstructions
    )

    let partiallyBatchedInstructions: Instruction[] = []

    let batch: boolean = parameters.batch || true

    if (batch) {
      // By default, fund nexus, install SS module, deploy nexus will be batched
      // Even if we wanted to unbatch actions into multiple userOps ? The additional instructions and install SS will be
      // optimistically batched while the enable permissions actions will be unbatched down the line
      partiallyBatchedInstructions = await batchInstructions({
        accountAddress: client.account.signer.address,
        meeVersions,
        instructions: [...resolvedInstructions]
      })
    } else {
      // If batch: false is explicitly defined ? Everything will be unbatched.
      partiallyBatchedInstructions = [...resolvedInstructions]
    }

    const instructions = hasEnableSessionsInstructions
      ? [...partiallyBatchedInstructions, ...enableSessionsInstructions]
      : partiallyBatchedInstructions

    // proceed to execute the superTx that
    // will deploy accounts/install modules and enable sessions

    // If batch actions is disabled and there are enable permission inxs ? The quote will be unbatched
    const isUnbatchActionsRequired =
      !batchActions && hasEnableSessionsInstructions

    batch = isUnbatchActionsRequired ? false : batch

    // check if trigger is provided => use fusion flow
    if (parameters.trigger) {
      const quote = await getFusionQuote(client, {
        ...parameters,
        instructions,
        batch,
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
      batch,
      instructions,
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
    actions: sessionActions,
    // Actions are batched by default
    batchActions = true
  } = parameters

  if (!redeemer) {
    throw new Error("Smart session redeemer address is missing")
  }

  if (!sessionActions || sessionActions.length === 0) {
    throw new Error("Smart sessions actions are missing")
  }

  for (const { actions, chainId } of sessionActions) {
    if (actions.length === 0) {
      throw new Error(
        `Smart sessions actions are empty for the chain (${chainId})`
      )
    }
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
    new Set(sessionActions.map((sessionAction) => sessionAction.chainId))
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

      let sessionActionsForChain = sessionActions.filter(
        (sessionAction) => sessionAction.chainId === chainId
      )

      if (feeToken && feeToken.chainId === chainId) {
        sessionActionsForChain = addPaymentPolicyForActions(
          sessionActionsForChain,
          feeToken,
          maxPaymentAmount
        )
      }

      const defaultVersionConfig = getMEEVersion(DEFAULT_MEE_VERSION)

      const meeValidatorAddress =
        deployment.version.validatorAddress ||
        defaultVersionConfig.validatorAddress

      if (batchActions && sessionActionsForChain.length > 1) {
        sessionActionsForChain = client.account.buildAction({
          type: "batch",
          data: {
            actions: sessionActionsForChain
          }
        })
      }

      const session: Session = {
        // MEE K1 validator is our session validator
        sessionValidator: meeValidatorAddress,
        // Initdata for the MEE K1 validator is just the signer address
        sessionValidatorInitData: redeemer,
        salt: generateSalt(),
        userOpPolicies: permitERC4337Paymaster ? [getSudoPolicy()] : [],
        erc7739Policies: { allowedERC7739Content: [], erc1271Policies: [] },
        // If the actions are batched ? all the actions will be available in first elements itself
        // If its unbatched ? It will be reassigned below
        actions: sessionActionsForChain[0].actions,
        permitERC4337Paymaster,
        chainId: BigInt(chainId)
      }

      const sessionDetailsSignature = getOwnableValidatorMockSignature({
        threshold: 1
      })

      const permissionId = getPermissionId({
        session: session
      })

      let enableSessionInstructions: Instruction[] = []

      if (!batchActions) {
        const condition = createCondition({
          targetContract: deployment.address,
          functionAbi: NexusImplementationAbi,
          functionName: "isModuleInstalled",
          args: [
            parseModuleTypeId(parameters.smartSessionsValidator.type),
            getAddress(parameters.smartSessionsValidator.address),
            "0x"
          ],
          value: true,
          type: ConditionType.EQ,
          description: "Smart sessions module must be installed"
        })

        for (const { actions } of sessionActionsForChain) {
          const sessionGroup = {
            ...session,
            actions: actions
          }

          const instructions = await client.account.buildComposable({
            type: "default",
            data: {
              abi: SmartSessionAbi,
              functionName: "enableSessions",
              args: [[sessionGroup]],
              to: SMART_SESSIONS_ADDRESS,
              chainId,
              conditions: [condition],
              simulationOverrides: {
                customOverrides: getCustomStateOverridesForIsModuleInstalled(
                  parameters.smartSessionsValidator.address,
                  deployment.address,
                  chainId
                )
              },
              metadata: [
                {
                  type: "CUSTOM",
                  description: "Enable smart sessions permissions",
                  chainId
                }
              ]
            }
          })

          enableSessionInstructions.push(...instructions)
        }
      } else {
        enableSessionInstructions = await client.account.buildComposable({
          type: "default",
          data: {
            abi: SmartSessionAbi,
            functionName: "enableSessions",
            args: [[session]],
            to: SMART_SESSIONS_ADDRESS,
            chainId,
            metadata: [
              {
                type: "CUSTOM",
                description: "Enable smart sessions permissions",
                chainId
              }
            ]
          }
        })
      }

      return {
        instructions: enableSessionInstructions,
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

export const getCustomStateOverridesForIsModuleInstalled = (
  validatorAddress: Address,
  accountAddress: Address,
  chainId: number
): CustomOverride[] => {
  // EERC-7201 namespaced storage slot where the AccountStorage struct starts for Nexus
  const STORAGE_LOCATION: Hex =
    "0x0bb70095b32b9671358306b0339b4c06e7cbd8cb82505941fba30d1eb5b82f00"
  // A SentinelList is a circular linked list that uses a special "SENTINEL" address (0x1)
  const SENTINEL: Address = "0x0000000000000000000000000000000000000001"

  const getValidatorSlot = (validatorAddress: Address): Hex => {
    const encoded = encodeAbiParameters(
      parseAbiParameters("address, bytes32"),
      [validatorAddress, STORAGE_LOCATION]
    )

    return keccak256(encoded)
  }

  const customOverrides: CustomOverride[] = []

  const customOverrideForValidator: CustomOverride = {
    contractAddress: accountAddress,
    storageSlot: getValidatorSlot(validatorAddress),
    chainId,
    value: toBytes32(SENTINEL)
  }

  customOverrides.push(customOverrideForValidator)

  return customOverrides
}

export const addPaymentPolicyForActions = (
  sessionActionsForChain: SessionAction[],
  feeToken: FeeTokenInfo,
  maxPaymentAmount: bigint
): SessionAction[] => {
  const transferSelector = toFunctionSelector(
    getAbiItem({ abi: erc20Abi, name: "transfer" })
  )

  let updatedSessionActionsForChain: SessionAction[] =
    sessionActionsForChain.map((sessionAction) => {
      const updatedActions = sessionAction.actions.map((action) => {
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

      return {
        ...sessionAction,
        actions: updatedActions
      }
    })

  const isPolicyForPaymentTokenExists = updatedSessionActionsForChain.some(
    (sessionAction) => {
      return sessionAction.actions.some((action) => {
        return (
          action.actionTargetSelector.toLowerCase() ===
            transferSelector.toLowerCase() &&
          action.actionTarget.toLowerCase() === feeToken.address.toLowerCase()
        )
      })
    }
  )

  if (!isPolicyForPaymentTokenExists) {
    let isPaymentPolicyAdded = false

    const paymentAction: ActionData = {
      actionTarget: feeToken.address,
      actionTargetSelector: transferSelector,
      actionPolicies: [
        getSpendingLimitsPolicy([
          { limit: maxPaymentAmount, token: feeToken.address }
        ])
      ]
    }

    updatedSessionActionsForChain = updatedSessionActionsForChain.map(
      (sessionAction) => {
        // Payment policy will be added into the first session action for the payment chain
        if (
          !isPaymentPolicyAdded &&
          sessionAction.chainId === feeToken.chainId
        ) {
          isPaymentPolicyAdded = true
          return {
            ...sessionAction,
            actions: [...sessionAction.actions, paymentAction]
          }
        }

        return sessionAction
      }
    )
  }

  return updatedSessionActionsForChain
}
