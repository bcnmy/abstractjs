import { zeroAddress } from "viem"
import {
  type MEEVersionConfig,
  versionIsAtLeast
} from "../../../account/utils/getVersion"
import { MEEVersion } from "../../../constants"
import {
  type ToMeeK1ModuleParameters,
  toMeeK1Module
} from "../meeK1/toMeeK1Module"
import {
  type ToStxValidatorParameters,
  toStxValidator
} from "../stxValidator/toStxValidator"
import type { Validator } from "../toValidator"

// Re-export types for backwards compatibility
export {
  type MeeSignatureType,
  getMeeK1ModuleStubSignature
} from "../meeK1/toMeeK1Module"
export {
  type StxSignatureType,
  getStxValidatorStubSignature
} from "../stxValidator/toStxValidator"

export type ToDefaultModuleParameters = Omit<
  ToMeeK1ModuleParameters & ToStxValidatorParameters,
  "module"
> & {
  meeConfig?: MEEVersionConfig
}

export const toDefaultModule = (
  parameters: ToDefaultModuleParameters
): Validator => {
  // If meeConfig provided and version is V3.0.0+, use StxValidator
  if (
    parameters.meeConfig &&
    versionIsAtLeast(parameters.meeConfig.version, MEEVersion.V3_0_0)
  ) {
    return toStxValidator({
      ...parameters,
      module: zeroAddress,
      address: zeroAddress,
      submodules: parameters.meeConfig.submodules
    })
  }

  // Default to MeeK1Validator (for V2.x.x and earlier, or when no version provided)
  return toMeeK1Module({
    ...parameters,
    module: zeroAddress,
    address: zeroAddress
  })
}
