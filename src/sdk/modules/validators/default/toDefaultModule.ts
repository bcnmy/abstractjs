import { zeroAddress } from "viem"
import {
  type ToMeeK1ModuleParameters,
  toMeeK1Module
} from "../meeK1/toMeeK1Module"
import type { Validator } from "../toValidator"

// Re-export types from toMeeK1Module for backwards compatibility
export { type MeeSignatureType, getMeeK1ModuleStubSignature } from "../meeK1/toMeeK1Module"

export type ToDefaultModuleParameters = Omit<ToMeeK1ModuleParameters, "module">

export const toDefaultModule = (
  parameters: ToDefaultModuleParameters
): Validator => {
  return toMeeK1Module({
    ...parameters,
    module: zeroAddress,
    address: zeroAddress
  })
}
