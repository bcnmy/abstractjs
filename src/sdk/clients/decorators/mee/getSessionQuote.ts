import {
  type Address,
  type Hex,
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
import { batchInstructions, resolveInstructions } from "../../../account"
import type { SessionAction } from "../../../account/decorators/buildAction"
import { toBytes32 } from "../../../account/utils/Utils"
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
} from "../../../constants"
import {
  type AnyData,
  ConditionType,
  createCondition,
  generateSalt,
  getMEEVersion
} from "../../../modules"
import type { GrantMeePermissionPayload } from "../../../modules/validators/smartSessions/decorators/mee/grantMeePermission"
import type { BaseMeeClient } from "../../createMeeClient"
import { toInstallWithSafeSenderCalls } from "../erc7579/installModule"
import { isModuleInstalled } from "../erc7579/isModuleInstalled"
import { parseModuleTypeId } from "../erc7579/supportsModule"
import getFusionQuote, { type GetFusionQuoteParams } from "./getFusionQuote"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import getQuote, {
  type CustomOverride,
  type EIP7702AuthorizationParams,
  type FeePaymentParams,
  type FeeTokenInfo,
  type GetQuoteParams,
  type GetQuotePayload,
  type Instruction,
  type InstructionLike
} from "./getQuote"
import type { QuoteType } from "./getQuoteType"
import type { Trigger } from "./signPermitQuote"

export type SessionDetail = GrantMeePermissionPayload[0]

export type EnableSession = {
  redeemer: Address
  actions: SessionAction[]
  maxPaymentAmount?: bigint
  batchActions?: boolean
}

export type PrepareEnableSessionResponse = {
  instructions: Instruction[]
  sessionDetails: SessionDetail
}

export type BaseSessionQuoteResponse = {
  quoteType: QuoteType
  quote: GetQuotePayload | GetPermitQuotePayload | GetOnChainQuotePayload
}

interface GetSessionQuoteResponseConfig {
  PREPARE:
    | (BaseSessionQuoteResponse & {
        sessionDetails?: SessionDetail[]
      })
    | undefined
  USE: BaseSessionQuoteResponse
}

export type SessionQuoteMode = keyof GetSessionQuoteResponseConfig

type BaseQuoteParamsForSessionQuote = Omit<
  GetQuoteParams,
  "smartSessionMode" | "instructions"
> & { instructions?: InstructionLike[] } & FeePaymentParams &
  EIP7702AuthorizationParams

type BaseSessionQuoteParams = BaseQuoteParamsForSessionQuote & {
  trigger?: Trigger
}

type SessionQuotePrepareParams = BaseSessionQuoteParams & {
  mode: "PREPARE"
  smartSessionValidatorAddress?: Address
  enableSession?: EnableSession
}

type SessionQuoteUseParams = BaseSessionQuoteParams & {
  mode: "USE"
  sessionDetails: SessionDetail[]
}

export type GetSessionQuoteParams =
  | SessionQuotePrepareParams
  | SessionQuoteUseParams

// Conditional return type based on the actual parameter type
export type GetSessionQuoteResponse<T extends GetSessionQuoteParams> =
  T extends SessionQuotePrepareParams
    ? GetSessionQuoteResponseConfig["PREPARE"]
    : T extends SessionQuoteUseParams
      ? GetSessionQuoteResponseConfig["USE"]
      : never

export const prepareInstallSessionValidator = async (
  client: BaseMeeClient,
  smartSessionValidatorAddress = SMART_SESSIONS_ADDRESS
): Promise<Instruction[]> => {
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
              address: smartSessionValidatorAddress,
              initData: "0x",
              type: "validator"
            }
          })
        : false

      // it will also include the deployment instruction if needed
      if (!isModuleInstalled_) {
        const installModuleCalls = await toInstallWithSafeSenderCalls(
          deployment,
          {
            address: smartSessionValidatorAddress,
            initData: "0x",
            type: "validator"
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

  return installInstructions.filter((inx) => inx !== undefined).flat()
}

export const prepareEnableSessions = async (
  client: BaseMeeClient,
  enableSession: EnableSession,
  // Default to official smart session validator address
  smartSessionValidatorAddress = SMART_SESSIONS_ADDRESS,
  feeToken?: FeeTokenInfo
): Promise<PrepareEnableSessionResponse[]> => {
  const {
    redeemer,
    maxPaymentAmount: maxPaymentAmount_,
    actions: sessionActions,
    // Actions are batched by default
    batchActions = true
  } = enableSession

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
            parseModuleTypeId("validator"),
            getAddress(smartSessionValidatorAddress),
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
                  smartSessionValidatorAddress,
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

/**
 * Gets a session quote for a set of actions and session configuration using the MEE service.
 * This method prepares a quote either for PREPARE mode (for deploying or enabling a session)
 * or for USE mode (for using an already enabled session).
 *
 * @param client - The base MEE client instance
 * @param parameters - The parameters for the quote request, including instructions, session configuration, mode, and optionally trigger details and fee token
 * @returns Promise resolving to a GetSessionQuoteResponse containing the quote payload and optional session details
 *
 * @example
 * ```typescript
 * const sessionQuote = await getSessionQuote(meeClient, {
 *   mode: "PREPARE",
 *   smartSessionValidatorAddress: '0x',
 *   enableSession: sessionEnableDetails,
 *   feeToken: { address: ..., chainId: ... },
 *   instructions: [ ... ],
 * });
 * ```
 *
 * @example
 * ```typescript
 * const sessionQuote = await getSessionQuote(meeClient, {
 *   mode: "USE",
 *   sessionDetails: [ ... ],
 *   feeToken: { address: ..., chainId: ... },
 *   instructions: [ ... ]
 * });
 * ```
 */
export const getSessionQuote = async <T extends GetSessionQuoteParams>(
  client: BaseMeeClient,
  parameters: T
): Promise<GetSessionQuoteResponse<T>> => {
  const {
    mode,
    // By default, emtpy instructions
    instructions = [],
    feeToken,
    trigger,
    // By default the batch will be true
    batch = true
  } = parameters

  const meeVersions = client.account.deployments.map(({ version, chain }) => ({
    chainId: chain.id,
    version
  }))

  if (mode === "PREPARE") {
    const { smartSessionValidatorAddress, enableSession } = parameters

    const batchActions: boolean = enableSession?.batchActions || true

    // Prepare session validator install instructions
    const sessionValidatorInstallInstructions =
      await prepareInstallSessionValidator(client, smartSessionValidatorAddress)

    const hasSessionValidatorInstallInstructions =
      sessionValidatorInstallInstructions.length > 0

    // Prepare session enable instructions
    const enableSessionsInstructions: Instruction[] = []
    const sessionDetailsArray: SessionDetail[] = []

    if (enableSession) {
      const enableSessionsInstructionsWithSessionDetails =
        await prepareEnableSessions(
          client,
          enableSession,
          smartSessionValidatorAddress,
          feeToken
        )

      for (const {
        instructions,
        sessionDetails
      } of enableSessionsInstructionsWithSessionDetails) {
        sessionDetailsArray.push(sessionDetails)
        enableSessionsInstructions.push(...instructions)
      }
    }

    const hasEnableSessionsInstructions = enableSessionsInstructions.length > 0

    // Additional instructions
    const hasInstructions = instructions.length > 0

    // Funding instructions
    const hasFundingRequest = !!trigger

    if (
      !hasSessionValidatorInstallInstructions &&
      !hasEnableSessionsInstructions &&
      !hasInstructions &&
      !hasFundingRequest
    ) {
      return undefined as GetSessionQuoteResponse<T>
    }

    const resolvedInstructions = await resolveInstructions([
      ...sessionValidatorInstallInstructions,
      ...instructions
    ])

    let partiallyBatchedInstructions: Instruction[] = []

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

    const finalInstructions = [
      ...partiallyBatchedInstructions,
      ...enableSessionsInstructions
    ]

    // If batch actions is disabled and there are enable permission inxs ? The quote will be unbatched
    const isUnbatchActionsRequired =
      !batchActions && hasEnableSessionsInstructions

    const {
      // Avoiding these params to be passed forward
      mode: _avoidOne,
      smartSessionValidatorAddress: _avoidTwo,
      enableSession: _avoidThree,
      ...rest
    } = parameters

    if (hasFundingRequest) {
      // Safe and Delegated smart accounts are not supported here
      const fusionQuote = await getFusionQuote(client, {
        ...rest,
        trigger: rest.trigger!,
        feePayer: undefined,
        batch: isUnbatchActionsRequired ? false : batch,
        instructions: finalInstructions
      } as GetFusionQuoteParams)

      return {
        quoteType: fusionQuote.quote.quoteType!,
        quote: fusionQuote,
        ...(sessionDetailsArray.length > 0
          ? { sessionDetails: sessionDetailsArray }
          : {})
      } as GetSessionQuoteResponse<T>
    }

    const quote = await getQuote(client, {
      ...rest,
      batch: isUnbatchActionsRequired ? false : batch,
      instructions: finalInstructions
    } as GetQuoteParams)

    return {
      quoteType: quote.quoteType!,
      quote,
      ...(sessionDetailsArray.length > 0
        ? { sessionDetails: sessionDetailsArray }
        : {})
    } as GetSessionQuoteResponse<T>
  }

  const {
    sessionDetails,
    // Avoiding these params to be passed forward
    mode: _avoidOne,
    ...rest
  } = parameters

  const isEnableAndUseSessionDetailExists = sessionDetails.some(
    (sessionDetailsInfo) =>
      sessionDetailsInfo.mode === SmartSessionMode.UNSAFE_ENABLE
  )

  if (isEnableAndUseSessionDetailExists) {
    throw new Error(
      "ENABLE_AND_USE mode is not supported, session details is invalid."
    )
  }

  const quote = await getQuote(client, {
    ...rest,
    moduleAddress: SMART_SESSIONS_ADDRESS,
    shortEncodingSuperTxn: true,
    // The mode will be always USE.
    smartSessionMode: "USE",
    sessionDetails
  } as GetQuoteParams)

  const startIndex = quote.paymentInfo.sponsored ? 1 : 0

  for (const [index, userOp] of quote.userOps.entries()) {
    // Skip payment userOp if sponsored
    if (index < startIndex) continue

    const relevantIndex = sessionDetails.findIndex(
      ({ enableSessionData }) =>
        enableSessionData?.enableSession?.sessionToEnable?.chainId ===
        BigInt(userOp.chainId)
    )

    if (relevantIndex === -1) {
      throw new Error(`No session details found for chainId ${userOp.chainId}`)
    }

    userOp.sessionDetails = sessionDetails[relevantIndex]
  }

  return {
    quoteType: quote.quoteType!,
    quote
  } as GetSessionQuoteResponse<T>
}
