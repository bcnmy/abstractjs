import type { Address } from "viem"
import { batchInstructions, resolveInstructions } from "../../../../../account"
import type { SessionActionLike } from "../../../../../account/decorators/buildSessionAction"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import {
  type EnableSession,
  type ExecuteSignedQuotePayload,
  type FeePaymentParams,
  type Instruction,
  type Trigger,
  prepareEnableSessions,
  prepareInstallSmartSessions
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
import type { Validator } from "../../../toValidator"
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
  actions?: SessionActionLike[]
  batchActions?: boolean
} & FeePaymentParams &
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

  // Prepare session validator install instructions
  const installInstructions = await prepareInstallSmartSessions(
    client,
    parameters.smartSessionsValidator.address
  )

  const hasInstallInstructions = installInstructions.length > 0

  const enableSessionsInstructions: Instruction[] = []
  const sessionDetailsArray: GrantPermissionResponse = []

  if (parameters.redeemer && parameters.actions) {
    const enableSession: EnableSession = {
      redeemer: parameters.redeemer,
      actions: parameters.actions,
      maxPaymentAmount: parameters.maxPaymentAmount,
      batchActions: parameters.batchActions
    }

    const enableSessionsInstructionsWithSessionDetails =
      await prepareEnableSessions(
        client,
        enableSession,
        parameters.smartSessionsValidator.address,
        parameters.feeToken
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

  if (
    hasInstallInstructions ||
    hasEnableSessionsInstructions ||
    parameters.additionalInstructions ||
    parameters.trigger
  ) {
    const unresolvedInstructions = parameters.additionalInstructions
      ? [...installInstructions, ...parameters.additionalInstructions]
      : installInstructions

    const resolvedInstructions = await resolveInstructions(
      unresolvedInstructions
    )

    let partiallyBatchedInstructions: Instruction[] = []

    let batch: boolean = parameters.batch ?? true

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
