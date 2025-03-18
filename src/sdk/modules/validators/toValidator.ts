import type { Hex, SignableMessage } from "viem"
import { sanitizeSignature } from "../../modules/utils/Helpers.js"
import type { Module, ModuleParameters } from "../../modules/utils/Types.js"
import { DUMMY_SIGNATURE } from "./k1Validator/toK1Validator"

export function toValidator(parameters: ModuleParameters): Module {
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
