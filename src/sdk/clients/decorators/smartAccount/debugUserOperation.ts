import type { BaseError, Chain, Client, Hex, Transport } from "viem"
import {
  type FormatUserOperationRequestErrorType,
  type PrepareUserOperationErrorType,
  type SendUserOperationParameters,
  type SmartAccount,
  type UserOperation,
  formatUserOperationRequest,
  getUserOperationError,
  toPackedUserOperation
} from "viem/account-abstraction"
import { parseAccount } from "viem/accounts"
import type { RequestErrorType } from "viem/utils"
import { AccountNotFoundError } from "../../../account/utils/AccountNotFound"
import { parseRequestArguments } from "../../../account/utils/Utils"
import { deepHexlify } from "../../../account/utils/deepHexlify"
import { getAAError } from "../../../account/utils/getAAError"
import {
  DUMMY_SIMULATION_GAS,
  tenderlySimulation
} from "../../../account/utils/tenderlySimulation"
import type { AnyData } from "../../../modules/utils/Types"
export type DebugUserOperationParameters = SendUserOperationParameters
export type DebugUserOperationReturnType = Hex

export type DebugUserOperationErrorType =
  | FormatUserOperationRequestErrorType
  | PrepareUserOperationErrorType
  | RequestErrorType

/**
 * Broadcasts a User Operation to the Bundler.
 *
 * - Docs: https://viem.sh/actions/bundler/debugUserOperation
 *
 * @param client - Client to use
 * @param parameters - {@link DebugUserOperationParameters}
 * @returns The User Operation hash. {@link DebugUserOperationReturnType}
 *
 * @example
 * import { createBundlerClient, http, parseEther } from 'viem'
 * import { mainnet } from 'viem/chains'
 * import { toSmartAccount } from 'viem/accounts'
 * import { debugUserOperation } from 'viem/actions'
 *
 * const account = await toSmartAccount({ ... })
 *
 * const bundlerClient = createBundlerClient({
 *   chain: mainnet,
 *   transport: http(),
 * })
 *
 * const values = await debugUserOperation(bundlerClient, {
 *   account,
 *   calls: [{ to: '0x...', value: parseEther('1') }],
 * })
 */
export async function debugUserOperation<
  account extends SmartAccount | undefined
>(
  client: Client<Transport, Chain | undefined, account>,
  parameters: DebugUserOperationParameters
) {
  const chainId = Number(client.account?.client?.chain?.id?.toString() ?? 84532)

  try {
    const { account: account_ = client.account, entryPointAddress } = parameters

    if (!account_ && !parameters.sender) throw new AccountNotFoundError()
    const account = account_ ? parseAccount(account_) : undefined

    // @ts-ignore
    const callData = await account?.encodeCalls(parameters?.calls)
    // @ts-ignore
    const sender = await account?.getAddress()
    // @ts-ignore
    const nonce = await account?.getNonce()
    // @ts-ignore
    const factoryArgs = await account?.getFactoryArgs()

    const request = {
      sender,
      callData,
      nonce,
      ...factoryArgs,
      ...parameters,
      ...DUMMY_SIMULATION_GAS
    }

    const signature = (parameters.signature ||
      (await account?.signUserOperation(request as UserOperation)))!

    const userOpWithSignature = { ...request, signature } as UserOperation

    const packed = toPackedUserOperation(userOpWithSignature)
    console.log(
      "Packed userOp:\n",
      JSON.stringify([deepHexlify(packed)], null, 2)
    )
    const rpcParameters = formatUserOperationRequest(userOpWithSignature)
    console.log("Bundler userOp:", rpcParameters)

    const tenderlyUrl = tenderlySimulation(rpcParameters, chainId)
    console.log({ tenderlyUrl })

    try {
      const hash = await client.request(
        {
          method: "eth_sendUserOperation",
          params: [
            rpcParameters,
            (entryPointAddress ?? account?.entryPoint.address)!
          ]
        },
        { retryCount: 0 }
      )
      console.log("User Operation Hash:", hash)
      return hash
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    } catch (error: any) {
      if (error?.details) {
        const aaError = await getAAError(error?.details)
        console.log({ aaError })
      }

      const calls = (parameters as AnyData).calls
      throw getUserOperationError(error as BaseError, {
        ...(request as UserOperation),
        ...(calls ? { calls } : {}),
        signature
      })
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } catch (error: any) {
    if (error.metaMessages) {
      try {
        const messageJson = parseRequestArguments(error.metaMessages)
        const tenderlyUrl = tenderlySimulation(messageJson)
        console.log({ tenderlyUrl })
      } catch (error) {}
    }
    throw error
  }
}
