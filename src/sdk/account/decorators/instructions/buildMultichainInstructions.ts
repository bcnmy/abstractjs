import type { OneOf } from "viem"
import type { AbstractCall, Instruction } from "../../../clients/decorators/mee"
import type { Call } from "../../utils/Types"
import type { BaseInstructionsParams } from "../build"

import { erc7579Calls } from "../../../clients/decorators/erc7579"
import { smartAccountCalls } from "../../../clients/decorators/smartAccount"
import type { AnyData, ModularSmartAccount } from "../../../modules/utils/Types"
import { ownableCalls } from "../../../modules/validators/ownable/decorators"
import { smartSessionCalls } from "../../../modules/validators/smartSessions/decorators"

export const globalCalls = {
  ...erc7579Calls,
  ...smartAccountCalls,
  ...smartSessionCalls,
  ...ownableCalls
} as const

export type MethodKeys = keyof typeof globalCalls
// biome-ignore lint/complexity/noBannedTypes: Later inference will be used
type ArgumentTypes<F extends Function> = F extends (
  account: ModularSmartAccount,
  args: infer A
) => AnyData
  ? A
  : never

export type BuildMultichainInstructionsParameters = {
  chainId: number
} & OneOf<
  | {
      calls: Call[]
    }
  | {
      type: MethodKeys
      parameters: ArgumentTypes<(typeof globalCalls)[MethodKeys]>
    }
>

export const buildMultichainInstructions = async (
  baseParams: BaseInstructionsParams,
  parameters: BuildMultichainInstructionsParameters
): Promise<Instruction[]> => {
  const { currentInstructions = [], account } = baseParams
  const { calls: calls_, type, parameters: parametersForType } = parameters

  const instructions = await Promise.all(
    account.deployments.map(async (account) => {
      let callsPerChain: AbstractCall[] = []
      const chainId = account.client.chain?.id
      if (!chainId) {
        throw new Error("Chain ID is not set")
      }
      if (calls_) {
        callsPerChain = calls_ as AbstractCall[]
      } else if (type) {
        callsPerChain = (await globalCalls[type](
          account,
          parametersForType as AnyData
        )) as AbstractCall[]
      }
      return { calls: callsPerChain, chainId }
    })
  )

  return [...currentInstructions, ...instructions]
}

export default buildMultichainInstructions
