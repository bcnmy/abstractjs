import type {
  Chain,
  Client,
  Prettify,
  TransactionReceipt,
  Transport
} from "viem"
import {
  type BicoUserOperationGasPriceWithBigIntAsHex,
  type GetGasFeeValuesReturnType,
  getGasFeeValues
} from "./getGasFeeValues"
import {
  getUserOperationStatus,
  type GetUserOperationStatusParameters,
  type GetUserOperationStatusReturnType
} from "./getUserOperationStatus"
import { waitForConfirmedTransactionReceipt } from "./waitForConfirmedTransactionReceipt"

export type BicoRpcSchema = [
  {
    Method: "biconomy_getGasFeeValues" | "pimlico_getUserOperationGasPrice"
    Parameters: []
    ReturnType: BicoUserOperationGasPriceWithBigIntAsHex
  },
  {
    Method: "biconomy_getUserOperationStatus"
    Parameters: [string]
    ReturnType: GetUserOperationStatusReturnType
  }
]

export type BicoActions = {
  /**
   * Returns the live gas prices that you can use to send a user operation.
   *
   * @returns slow, standard & fast values for maxFeePerGas & maxPriorityFeePerGas {@link GetGasFeeValuesReturnType}
   *
   * @example
   *
   * import { createClient } from "viem"
   * import { bicoBundlerActions } from "@biconomy/abstractjs"
   *
   * const bundlerClient = createClient({
   *      chain: goerli,
   *      transport: http("https://api.biconomy.io/v2/goerli/rpc?apikey=YOUR_API_KEY_HERE")
   * }).extend(bicoBundlerActions())
   *
   * await bundlerClient.getGasFeeValues()
   */
  getGasFeeValues: () => Promise<Prettify<GetGasFeeValuesReturnType>>
  /**
   * Returns the status of a user operation.
   * @param params - {@link GetUserOperationStatusParameters}
   * @returns The user operation status. {@link GetUserOperationStatusReturnType}
   */
  getUserOperationStatus: (
    parameters: GetUserOperationStatusParameters
  ) => Promise<GetUserOperationStatusReturnType>
  /**
   * Waits for a transaction receipt to be confirmed.
   * @param params - {@link WaitForConfirmedTransactionReceiptParameters}
   * @returns The transaction receipt. {@link WaitForConfirmedTransactionReceiptReturnType}
   */
  waitForConfirmedTransactionReceipt: (
    params: GetUserOperationStatusParameters
  ) => Promise<TransactionReceipt>
}

export const bicoBundlerActions =
  () =>
  <
    TTransport extends Transport,
    TChain extends Chain | undefined = Chain | undefined
  >(
    client: Client<TTransport, TChain>
  ): BicoActions => ({
    getGasFeeValues: async () => getGasFeeValues(client),
    getUserOperationStatus: async (
      parameters: GetUserOperationStatusParameters
    ) => getUserOperationStatus(client, parameters),
    waitForConfirmedTransactionReceipt: async (
      parameters: GetUserOperationStatusParameters
    ) => waitForConfirmedTransactionReceipt(client, parameters)
  })
