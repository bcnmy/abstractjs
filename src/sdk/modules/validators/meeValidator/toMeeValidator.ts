import {
  type Hex,
  type RequiredBy,
  type SignableMessage,
  concatHex
} from "viem"
import { MEE_VALIDATOR_ADDRESS } from "../../../constants"

import type { Signer } from "../../../account/utils/toSigner"
import { toValidator } from "../../../modules/validators/toValidator"
import { DUMMY_SIGNATURE } from "../k1Validator"
import type { ValidatorParameters } from "../types"

export type MeeValidatorParameters = RequiredBy<ValidatorParameters, "signer">
export const toMeeValidator = ({ signer }: { signer: Signer }) =>
  toValidator({
    signer: signer,
    module: MEE_VALIDATOR_ADDRESS,
    initData: signer.address,
    getStubSignature: async () => concatHex(["0xff", DUMMY_SIGNATURE]),
    signUserOpHash: async (userOpHash: Hex) => {
      const signature = await signer.signMessage({
        message: { raw: userOpHash }
      })
      return concatHex(["0xff", signature])
    },
    signMessage: async (message: SignableMessage) => {
      const signature = await signer.signMessage({ message })
      return concatHex(["0xff", signature])
    }
  })
