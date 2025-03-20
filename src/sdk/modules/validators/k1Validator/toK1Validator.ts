import {
  type Address,
  type Hex,
  type SignableMessage,
  encodePacked
} from "viem"
import type { Signer } from "../../../account/utils/toSigner"
import { K1_VALIDATOR_ADDRESS } from "../../../constants"
import { sanitizeSignature } from "../../../modules/utils/Helpers"
import type { ModuleMeta, ModuleParameters } from "../../../modules/utils/Types"
import { toValidator } from "../../../modules/validators/toValidator"
import type { Validator } from "../types"

export const DUMMY_SIGNATURE: Hex =
  "0x81d4b4981670cb18f99f0b4a66446df1bf5b204d24cfcb659bf38ba27a4359b5711649ec2423c5e1247245eba2964679b6a1dbb85c992ae40b9b00c6935b02ff1b"

export const toK1Validator = ({ signer }: { signer: Signer }): Validator => {
  return toValidator({
    signer,
    address: K1_VALIDATOR_ADDRESS,
    module: K1_VALIDATOR_ADDRESS,
    initData: signer.address,
    deInitData: "0x",
    getStubSignature: async () => DUMMY_SIGNATURE,
    signUserOpHash: async (userOpHash: Hex) => {
      const signature = await signer.signMessage({
        message: { raw: userOpHash as Hex }
      })
      return signature as Hex
    },
    signMessage: async (message: SignableMessage) =>
      sanitizeSignature(await signer.signMessage({ message }))
  })
}
