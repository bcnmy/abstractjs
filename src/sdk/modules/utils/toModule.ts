import type { Hex, SignableMessage } from "viem"
import { DUMMY_SIGNATURE } from "../k1Validator"
import { sanitizeSignature } from "./Helpers.js"
import type { Module, ModuleParameters } from "./Types.js"

/**
 * Creates a Module object from the given parameters parameters.
 *
 * This function takes the module parameters details and constructs a standardized
 * Module object with methods for signing and generating stub signatures.
 *
 * @param parameters - The parameters defining the module parameters.
 * @returns A Module object with standardized methods and properties.
 *
 * @example
 * ```typescript
 * const myModule = toModule({
 *   accountAddress: '0x1234...',
 *   address: '0x5678...',
 *   signer: mySigner,
 *   initData: '0xabcd...',
 *   // ... other parameters
 * });
 * ```
 *
 * @remarks
 * - The returned Module object includes methods for getting stub signatures, signing user operation hashes, and signing messages.
 * - The `getStubSignature` method generates a dummy signature for testing or placeholder purposes.
 * - The `signUserOpHash` and `signMessage` methods use the provided signer to create actual signatures.
 */
export function toModule(parameters: ModuleParameters): Module {
  const {
    account,
    extend,
    initArgs = {},
    deInitData = "0x",
    initData = "0x",
    moduleInitArgs = "0x",
    accountAddress = account?.address ?? "0x",
    moduleInitData = {
      address: "0x",
      type: "validator"
    },
    type = "validator",
    ...rest
  } = parameters

  return {
    ...parameters,
    initData,
    moduleInitData,
    moduleInitArgs,
    deInitData,
    accountAddress,
    initArgs,
    module: parameters.address,
    data: initData,
    type,
    getStubSignature: async () => DUMMY_SIGNATURE,
    signUserOpHash: async (userOpHash: Hex) =>
      await parameters.signer.signMessage({
        message: { raw: userOpHash }
      }),
    signMessage: async (message: SignableMessage) =>
      sanitizeSignature(await parameters.signer.signMessage({ message })),
    ...extend,
    ...rest
  }
}
