import { readContract } from "viem/actions"
import type { BaseMultichainSmartAccount } from ".."
import type { ReadDictionary } from "../../clients/decorators/erc7579"
import type { AnyData, ModularSmartAccount } from "../../modules/utils/Types"
import {
  GLOBAL_COMPOSABLE_READS,
  type SupportedRead
} from "../utils/composableReads"

// biome-ignore lint/complexity/noBannedTypes: Later inference will be used
type ArgumentTypes<F extends Function> = F extends (
  account: ModularSmartAccount,
  args: infer A
) => AnyData
  ? A
  : never

/**
 * Parameters for performing a multichain read operation.
 * @property type - The type of supported read operation to perform.
 * @property parameters - The arguments required for the selected read type.
 */
export type MultichainReadParameters = {
  type: SupportedRead
  parameters: ArgumentTypes<(typeof GLOBAL_COMPOSABLE_READS)[SupportedRead]>
}

/**
 * The payload type returned from a multichain read operation.
 */
export type MultiChainReadPayload<T> = T

/**
 * Executes a read operation across all deployments in a BaseMultichainSmartAccount.
 *
 * @param account - The multichain smart account containing deployments to read from.
 * @param parameters - {@link MultichainReadParameters} specifying the read type and its parameters.
 * @returns Promise resolving to an array of read payloads, one for each deployment.
 */
export const multichainRead = async <T>(
  account: BaseMultichainSmartAccount,
  parameters: MultichainReadParameters
): Promise<MultiChainReadPayload<T>[]> => {
  const { type, parameters: parametersForType } = parameters

  // Cast GLOBAL_COMPOSABLE_READS to ReadDictionary to ensure all read functions have a consistent type
  const readFunctions = GLOBAL_COMPOSABLE_READS as unknown as ReadDictionary
  const results = await Promise.all(
    account.deployments.map(async (account) => {
      const chainId = account.client.chain?.id
      if (!chainId) {
        throw new Error("Chain ID is not set")
      }
      // The read function now expects the updated parameters structure.
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
