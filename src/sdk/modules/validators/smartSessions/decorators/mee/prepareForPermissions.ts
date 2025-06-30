import type { Chain, Client, Transport } from "viem"
import { build } from "../../../../../account/decorators/build"
import type { BaseMeeClient } from "../../../../../clients/createMeeClient"
import { toInstallWithSafeSenderCalls } from "../../../../../clients/decorators/erc7579/installModule"
import { isModuleInstalled } from "../../../../../clients/decorators/erc7579/isModuleInstalled"
import type {
  AbstractCall,
  ExecuteSignedQuotePayload,
  FeeTokenInfo,
  Trigger
} from "../../../../../clients/decorators/mee"
import { execute } from "../../../../../clients/decorators/mee/execute"
import { executeFusionQuote } from "../../../../../clients/decorators/mee/executeFusionQuote"
import type { GetFusionQuoteParams } from "../../../../../clients/decorators/mee/getFusionQuote"
import { getFusionQuote } from "../../../../../clients/decorators/mee/getFusionQuote"
import type {
  GetQuoteParams,
  InstructionLike
} from "../../../../../clients/decorators/mee/getQuote"
import type { ModularSmartAccount } from "../../../../utils/Types"
import type { Validator } from "../../../toValidator"

// omit instructions, feeToken and trigger to make them optional
export type PrepareForPermissionsParams = Omit<
  GetFusionQuoteParams,
  "instructions" | "feeToken" | "trigger"
> & {
  smartSessionsValidator: Validator
  additionalInstructions?: InstructionLike[]
  feeToken?: FeeTokenInfo
  trigger?: Trigger
}

/**
 * Returns undefined if there was no need to prepare the superTx
 */
export type PrepareForPermissionsPayload = ExecuteSignedQuotePayload | undefined

export const prepareForPermissions = async (
  client: BaseMeeClient,
  parameters: PrepareForPermissionsParams
): Promise<PrepareForPermissionsPayload> => {
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
        ? await isModuleInstalled(
            deployment.client as unknown as Client<
              Transport,
              Chain | undefined,
              ModularSmartAccount
            >,
            {
              account: deployment,
              module: {
                address: parameters.smartSessionsValidator.address,
                initData: "0x",
                type: parameters.smartSessionsValidator.type
              }
            }
          )
        : false

      // it will also include the deployment instruction if needed
      if (!isModuleInstalled_) {
        return build(
          { account: client.account },
          {
            type: "default",
            data: {
              calls: (await toInstallWithSafeSenderCalls(deployment, {
                address: parameters.smartSessionsValidator.address,
                initData: "0x",
                type: parameters.smartSessionsValidator.type
              })) as AbstractCall[],
              chainId
            }
          }
        )
      }
      return undefined
    })
  )

  const hasInstallInstructions = installInstructions.some(Boolean)

  // if there are install instructions or additional instructions,
  // or trigger is provided,
  // we are going to create a superTx that prepares accounts
  // for usage with smart sessions (deploy, install module, fund etc)
  // that means we need to know the feeToken
  // then we'll use one of the MEE flows: fusion or standard
  if (
    hasInstallInstructions ||
    parameters.additionalInstructions ||
    parameters.trigger
  ) {
    // require that feeToken is provided
    if (!parameters.feeToken) {
      throw new Error("Fee token is required")
    }

    const cleanedInstallInstructions = installInstructions.filter(
      Boolean
    ) as InstructionLike[]
    const completeInstructionsList = parameters.additionalInstructions
      ? [...cleanedInstallInstructions, ...parameters.additionalInstructions]
      : cleanedInstallInstructions

    // proceed to execute the superTx that
    // will deploy accounts/install modules

    // check if trigger is provided => use fusion flow
    if (parameters.trigger) {
      const quote = await getFusionQuote(client, {
        ...parameters,
        instructions: completeInstructionsList,
        feeToken: parameters.feeToken!,
        trigger: parameters.trigger
      } as GetFusionQuoteParams)

      return await executeFusionQuote(client, {
        fusionQuote: quote,
        companionAccount: client.account
      })
    }

    // otherwise use standard flow
    return await execute(client, {
      ...parameters,
      instructions: completeInstructionsList,
      feeToken: parameters.feeToken!,
      trigger: parameters.trigger
    } as GetQuoteParams)
  }
  return undefined
}
