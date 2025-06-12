import { readContract } from "viem/actions"
import { erc7579Reads } from "../../clients/decorators/erc7579"
import type { ReadDictionary } from "../../clients/decorators/erc7579"
import type { AnyData, ModularSmartAccount } from "../../modules/utils/Types"
import { ownableReads } from "../../modules/validators/ownable/decorators"
import type { BaseInstructionsParams } from "./build"

export const GLOBAL_COMPOSABLE_READS = {
  ...erc7579Reads,
  ...ownableReads
} as const

export type SupportedRead = keyof typeof GLOBAL_COMPOSABLE_READS

// biome-ignore lint/complexity/noBannedTypes: Later inference will be used
type ArgumentTypes<F extends Function> = F extends (
  account: ModularSmartAccount,
  args: infer A
) => AnyData
  ? A
  : never

export type MultichainReadParameters = {
  type: SupportedRead
  parameters: ArgumentTypes<(typeof GLOBAL_COMPOSABLE_READS)[SupportedRead]>
}

export type MultiChainReadPayload<T> = T

export const multichainRead = async <T>(
  baseParams: BaseInstructionsParams,
  parameters: MultichainReadParameters
): Promise<MultiChainReadPayload<T>[]> => {
  const { account } = baseParams
  const { type, parameters: parametersForType } = parameters

  // Cast GLOBAL_COMPOSABLE_READS to ReadDictionary to ensure all read functions have a consistent type
  const readFunctions = GLOBAL_COMPOSABLE_READS as unknown as ReadDictionary

  const results = await Promise.all(
    account.deployments.map(async (account) => {
      const chainId = account.client.chain?.id
      if (!chainId) {
        throw new Error("Chain ID is not set")
      }

      const [readData] = await readFunctions[type](
        account,
        parametersForType as AnyData
      )

      return (await readContract(account.client, readData)) as T
    })
  )

  return results
}

export default multichainRead
