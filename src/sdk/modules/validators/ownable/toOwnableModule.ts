import type { Address, Hex } from "viem"
import type { Signer } from "../../../account/utils/toSigner"
import {
  getOwnableValidator,
  getOwnableValidatorMockSignature
} from "../../../constants"
import { type Validator, toValidator } from "../toValidator"

/**
 * Parameters for creating an Ownable module.
 * Extends ModuleParameters but replaces 'accountAddress' with 'account'.
 */
type ToOwnableModuleParameters = {
  /** The threshold number of signatures required for operations. */
  threshold: number
  /** Array of owner addresses for the module. */
  owners: Address[]
  /** Signer of the module. */
  signer: Signer
}

/**
 * Creates an Ownable module for a modular smart account.
 *
 * This function sets up an Ownable module with the specified parameters,
 * including threshold and owners for the smart account.
 *
 * @param parameters - The parameters for creating the Ownable module.
 * @returns A Module object representing the created Ownable module.
 *
 * @example
 * ```typescript
 * const ownableModule = toOwnableModule({
 *   account: mySmartAccount,
 *   signer: mySigner,
 *   moduleInitArgs: {
 *     threshold: 2,
 *     owners: ['0x123...', '0x456...']
 *   }
 * });
 * ```
 *
 * @remarks
 * - If the module is already installed, it will use the existing threshold.
 * - If not installed, it will use the threshold from the initialization parameters.
 * - The function generates a mock signature based on the threshold.
 */
export const toOwnableModule = (
  parameters: ToOwnableModuleParameters
): Validator => {
  const { signer, threshold, owners } = parameters

  return toValidator({
    ...getOwnableValidator({ threshold, owners }),
    type: "validator",
    signer,
    getStubSignature: async (): Promise<Hex> =>
      getOwnableValidatorMockSignature({ threshold })
  })
}
