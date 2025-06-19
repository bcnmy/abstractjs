import { type Hex, concatHex, zeroAddress } from "viem"
import { DUMMY_SIGNATURE } from "../smartSessions"
import {
  type Validator,
  type ValidatorParameters,
  toValidator
} from "../toValidator"

const MOCK_SUPERTXN_HASH_AND_TIMESTAMPS: Hex =
  "0x9e1cce57126e9205fe085888ed6b5ca0033f168e26b8927adb1c6da566cf7c5100000000000000000000000000000000000000000000000000000000642622800000000000000000000000000000000000000000000000000000000064262668"

export type MeeSignatureType =
  | "simple"
  | "no-mee"
  | "permit"
  | "on-chain"
  | "mm-dtk"
export const toDefaultModule = (
  parameters: Omit<ValidatorParameters, "module" | "initData"> & {
    signatureType?: MeeSignatureType
    superTxEntriesCount?: number
  }
): Validator => {
  const { signatureType = "simple", superTxEntriesCount = 3 } = parameters
  return toValidator({
    initData: parameters.signer.address,
    data: parameters.signer.address,
    deInitData: "0x",
    ...parameters,
    address: zeroAddress,
    module: zeroAddress,
    type: "validator",
    getStubSignature: async () =>
      getMeeK1ModuleStubSignature(signatureType, superTxEntriesCount)
  })
}

export const getMeeK1ModuleStubSignature = (
  signatureType: MeeSignatureType,
  superTxEntriesCount: number
): Hex => {
  // get the proof size for a given merkle tree size
  const leafCount = superTxEntriesCount + 1
  const proofSize = Math.ceil(Math.log2(leafCount))

  let prefix: Hex = "0x"
  let mockModePayload: Hex = "0x"

  if (signatureType === "no-mee") {
    return DUMMY_SIGNATURE
  }
  if (signatureType === "simple") {
    prefix = "0x177eee00"
    mockModePayload = concatHex([
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x00000000000000000000000000000000000000000000000000000000000000a0",
      "0x0000000000000000000000000000000000000000000000000000000000000100"
    ])
  }
  // for permit mode, on-chain mode, and mm-dtk mode, we imitate the sig structure
  // hex values are taken from a real signature for an according fusion mode
  // stub signatures are used to estimate gas and are not expected to be valid
  if (signatureType === "permit") {
    prefix = "0x177eee01"
    mockModePayload = concatHex([
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000001d1499e622d69689cdf9004d05ec547d650ff211000000000000000000000000a0cb889707d426a7a386870a03bc70d1b0697598fe8244a8453f6a5a1623e38a7117cfcadf84d670fe741a32e447cd5f5671a68b0000000000000000000000000000000000000000000000003782dace9d9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027d5730e3c64852e56f4f10c0c27a8d96651193fd13663c1dd652b5f18677458",
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000000250e2ad6bd90d6121dc5166dc6968f23ba43497594de5c7ca655f58e96d31775d"
    ])
  }
  if (signatureType === "on-chain") {
    prefix = "0x177eee02"
    mockModePayload = concatHex([
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000001d1499e622d69689cdf9004d05ec547d650ff211000000000000000000000000a0cb889707d426a7a386870a03bc70d1b0697598fe8244a8453f6a5a1623e38a7117cfcadf84d670fe741a32e447cd5f5671a68b000000000000000000000000000000000000000000000001158e460913d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x000000000000000000000000000000000000000000000000000000000000000568f7d0137aa459fc3d87c0405f9df08008c9b97b3da85ef4f663b0e4fc910b518146837426fd3167918049cae2bc9fdf90aabc1e9db16244b56a12463711c2d500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
    ])
  }

  // TODO: adjust this to the actual mm-dtk payload
  if (signatureType === "mm-dtk") {
    prefix = "0x177eee03"
    mockModePayload = concatHex([
      "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000001d1499e622d69689cdf9004d05ec547d650ff211000000000000000000000000a0cb889707d426a7a386870a03bc70d1b0697598fe8244a8453f6a5a1623e38a7117cfcadf84d670fe741a32e447cd5f5671a68b0000000000000000000000000000000000000000000000003782dace9d9000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027d5730e3c64852e56f4f10c0c27a8d96651193fd13663c1dd652b5f18677458",
      MOCK_SUPERTXN_HASH_AND_TIMESTAMPS,
      "0x00000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000000000000000000000000000000000000000000250e2ad6bd90d6121dc5166dc6968f23ba43497594de5c7ca655f58e96d31775d"
    ])
  }

  // use random 32 bytes as leaves
  const leaves = Array.from(
    { length: proofSize },
    () =>
      "0x3239aa7c79368121ae1a0e73b662a9fd8f0c7f6aa1a7dfdc2eebdbeb2f9b070c" as Hex
  )
  const proofPayload = concatHex([
    `0x${proofSize.toString(16).padStart(64, "0")}` as Hex,
    ...leaves
  ])

  return concatHex([
    prefix,
    mockModePayload,
    proofPayload,
    "0x0000000000000000000000000000000000000000000000000000000000000041", // length
    DUMMY_SIGNATURE
  ])
}
