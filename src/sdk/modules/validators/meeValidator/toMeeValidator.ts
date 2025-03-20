import { type Hex, concatHex } from "viem"
import { MEE_VALIDATOR_ADDRESS } from "../../../constants"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../../../modules/validators/smartSessions/toSmartSessionsValidator"
import { DUMMY_SIGNATURE } from "../k1Validator"

export const PREFIXES: Record<string, Hex> = {
  EIP_4337: "0xff",
  ERC20_PERMIT: "0x02",
  OFF_CHAIN: "0x00",
  ON_CHAIN: "0x01"
}

export const toMeeValidator = (
  parameters: Omit<ValidatorParameters, "module" | "initData">
): Validator =>
  toValidator({
    ...parameters,
    address: MEE_VALIDATOR_ADDRESS,
    module: MEE_VALIDATOR_ADDRESS,
    type: "validator",
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    getStubSignature: async () =>
      concatHex([PREFIXES.EIP_4337, DUMMY_SIGNATURE]),
    signUserOpHash: async (userOpHash: Hex) => {
      const signature = await parameters.signer.signMessage({
        message: { raw: userOpHash as Hex }
      })
      return concatHex([PREFIXES.EIP_4337, signature])
    }
  })
