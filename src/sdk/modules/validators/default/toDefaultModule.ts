import { type Hex, zeroAddress } from "viem"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

export const toDefaultModule = (
  parameters: Omit<ValidatorParameters, "module" | "initData"> & {
    mode?: "simple" | "no_mee" | "permit" | "on-chain"
    superTxEntriesCount?: number
  }
): Validator => {
  const { mode = "simple", superTxEntriesCount = 3 } = parameters
  return toValidator({
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    ...parameters,
    address: zeroAddress,
    module: zeroAddress,
    type: "validator",
    // TODO: make this signature dependent on the mode and numbers of userOps => proof size
    getStubSignature: async (): Promise<Hex> => {
      return getMeeK1ModuleStubSignature(mode, superTxEntriesCount)
    }
  })
}

export const getMeeK1ModuleStubSignature = (
  mode: "simple" | "no_mee" | "permit" | "on-chain",
  superTxEntriesCount: number
): Hex => {
  // get the proof size for a given merkle tree size
  const leafCount = superTxEntriesCount + 1
  const proofSize = Math.ceil(Math.log2(leafCount))

  const proofPayload = "0x"

  const signature = proofPayload + DUMMY_SIGNATURE

  return signature as `0x${string}`
}
