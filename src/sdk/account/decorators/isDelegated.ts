import type { BaseMultichainSmartAccount } from "../toMultiChainNexusAccount"

/**
 * Parameters for checking if the account is delegated
 * @property account - {@link BaseMultichainSmartAccount} The multichain smart account to check if it is delegated
 */
export type IsDelegatedParameters = {
  account: BaseMultichainSmartAccount
}

export type IsDelegatedPayload = boolean

/**
 * Checks if the account is delegated
 *
 * @param parameters - {@link IsDelegatedParameters} Configuration for checking if the account is delegated
 * @param parameters.account - The multichain smart account to check if it is delegated
 *
 * @returns Promise resolving to boolean
 *
 * @example
 * const isDelegated = await isDelegated({
 *   account: myMultichainAccount
 * });
 *
 * console.log(`Is delegated: ${isDelegated}`);
 */
export const isDelegated = async (
  parameters: IsDelegatedParameters
): Promise<IsDelegatedPayload> =>
  (
    await Promise.all(
      parameters.account.deployments.map(({ isDelegated }) => isDelegated())
    )
  ).every(Boolean)
