import { MEE_VALIDATOR_ADDRESS } from "../../constants"

import type { Module, ModuleParameters } from "../utils/Types"
import { toModule } from "../utils/toModule"

export const toMeeValidator = (
  parameters: Omit<ModuleParameters, "address">
): Module =>
  toModule({
    ...parameters,
    address: MEE_VALIDATOR_ADDRESS,
    type: "validator",
    initData: parameters.signer.address,
    deInitData: "0x"
  })
