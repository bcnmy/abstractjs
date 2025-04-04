import type { RpcUserOperation } from "viem"
import {
  type UserOperation,
  toPackedUserOperation
} from "viem/account-abstraction"
import { getTenderlyDetails } from "."
import { ENTRY_POINT_ADDRESS } from "../../constants"
import { deepHexlify } from "./deepHexlify"

export type AnyUserOperation = Partial<UserOperation<"0.7"> | RpcUserOperation>

export const DUMMY_SIMULATION_GAS = {
  callGasLimit: 1000000n,
  verificationGasLimit: 1000000n,
  preVerificationGas: 1000000n,
  maxFeePerGas: 1000000n,
  maxPriorityFeePerGas: 1000000n
}

export const getSimulationUserOp = (partialUserOp: AnyUserOperation) => {
  const mergedUserOp = deepHexlify({
    ...DUMMY_SIMULATION_GAS,
    ...partialUserOp
  })

  return toPackedUserOperation(mergedUserOp)
}

export function tenderlySimulation(
  partialUserOp: AnyUserOperation,
  chainId = 84532
) {
  const tenderlyDetails = getTenderlyDetails()

  if (!tenderlyDetails) {
    console.log(
      "Tenderly details not found in environment variables. Please set TENDERLY_API_KEY, TENDERLY_ACCOUNT_SLUG, and TENDERLY_PROJECT_SLUG."
    )
    return null
  }

  const tenderlyUrl = new URL(
    `https://dashboard.tenderly.co/${tenderlyDetails.accountSlug}/${tenderlyDetails.projectSlug}/simulator/new`
  )

  const packedUserOp = getSimulationUserOp(partialUserOp)

  console.log({ packedUserOp })

  const params = new URLSearchParams({
    contractAddress: ENTRY_POINT_ADDRESS,
    value: "0",
    network: chainId.toString(),
    contractFunction: "0x765e827f", // handleOps
    functionInputs: JSON.stringify([packedUserOp]),
    stateOverrides: JSON.stringify([
      {
        contractAddress: packedUserOp.sender,
        balance: "100000000000000000000"
      },
      {
        contractAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", // vitalek.eth
        balance: "100000000000000000000"
      }
    ])
  })

  tenderlyUrl.search = params.toString()
  return tenderlyUrl.toString()
}
