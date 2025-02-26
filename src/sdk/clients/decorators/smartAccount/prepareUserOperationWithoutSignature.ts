import { prepareUserOperation } from "viem/account-abstraction"

import type { Chain, Client, Transport } from "viem"
import type {
  PrepareUserOperationParameters,
  PrepareUserOperationRequest,
  PrepareUserOperationReturnType,
  SmartAccount
} from "viem/account-abstraction"
import { getAction } from "viem/utils"
import { safeMultiplier } from "../../../account/utils/Utils"
import type { AnyData } from "../../../modules/utils/Types"

const gasFields = [
  "preVerificationGas",
  "verificationGasLimit",
  "callGasLimit",
  "maxFeePerGas",
  "maxPriorityFeePerGas",
  "paymasterVerificationGasLimit",
  "paymasterPostOpGasLimit"
] as const

type GasBufferFields = (typeof gasFields)[number]

/** Gas buffer configuration. This can be used to apply a gas buffer to the user operation after gas estimates have been returned from the bundler. */
export type GasBufferFactor = {
  gasBuffer?: {
    /** The factor to multiply the gas limit by */
    factor: number
    /** The fields to apply the gas buffer to */
    fields: GasBufferFields[]
  }
}

export async function prepareUserOperationWithoutSignature<
  account extends SmartAccount | undefined,
  const calls extends readonly unknown[],
  const request extends PrepareUserOperationRequest<
    account,
    accountOverride,
    calls
  >,
  accountOverride extends SmartAccount | undefined = undefined
>(
  client: Client<Transport, Chain | undefined, account>,
  parameters: GasBufferFactor &
    PrepareUserOperationParameters<account, accountOverride, calls, request>
): Promise<
  Omit<
    PrepareUserOperationReturnType<account, accountOverride, calls, request>,
    "signature"
  >
> {
  const { gasBuffer, ...args } = parameters

  let userOp = await getAction(
    client,
    prepareUserOperation,
    "prepareUserOperation"
  )(args as AnyData)

  if (gasBuffer) {
    // Fields that need gas safety margin applied
    const { fields, factor } = gasBuffer
    const adjustedGasEstimates = gasFields.reduce(
      (adjustedValues, field) => {
        if (fields.includes(field)) {
          adjustedValues[field] = safeMultiplier(userOp[field], factor)
        }
        return adjustedValues
      },
      {} as Record<(typeof gasFields)[number], bigint>
    )

    // Apply gas safety margin to specified fields and merge with original userOp
    userOp = {
      ...userOp,
      ...adjustedGasEstimates
    }
  }

  // Remove signature from userOp if it exists
  const { signature, ...userOpWithoutSignature } = userOp

  // @ts-ignore
  return userOpWithoutSignature
}
