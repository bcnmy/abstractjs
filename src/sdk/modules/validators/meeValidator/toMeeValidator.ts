import { type Hex, concatHex } from "viem"
import { MEE_VALIDATOR_ADDRESS } from "../../../constants"

import type { Module, ModuleParameters } from "../../../modules/utils/Types"
import { toValidator } from "../../../modules/validators/toValidator"
import { DUMMY_SIGNATURE } from "../k1Validator"

export const toMeeValidator = (
  parameters: Omit<ModuleParameters, "address">
): Module =>
  toValidator({
    ...parameters,
    address: MEE_VALIDATOR_ADDRESS,
    type: "validator",
    data: parameters.signer.address,
    deInitData: "0x",
    getStubSignature: async () => concatHex(["0xff", DUMMY_SIGNATURE]),
    signUserOpHash: async (userOpHash: Hex) => {
      const signature = await parameters.signer.signMessage({
        message: { raw: userOpHash as Hex }
      })
      return concatHex(["0xff", signature])
    }
  })
