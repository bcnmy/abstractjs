import type { Address, Hex } from "viem"
import type { Signer } from "../../../account/utils/toSigner"
import {
  getOwnableValidator,
  getOwnableValidatorMockSignature
} from "../../../constants"
import { toValidator } from "../../validators/toValidator"
import type { Validator } from "../types"

export type OwnableValidatorParameters = {
  threshold: number
  owners: Address[]
  signer: Signer
}
export const toOwnableValidator = (
  parameters: OwnableValidatorParameters
): Validator => {
  const { signer, threshold, owners } = parameters

  return toValidator({
    signer,
    ...getOwnableValidator({
      threshold,
      owners
    }),
    type: "validator",
    getStubSignature: async (): Promise<Hex> =>
      getOwnableValidatorMockSignature({ threshold })
  })
}
