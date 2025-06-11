import type { Address, Hex } from "viem"
import type { BaseMeeClient } from "../../createMeeClient"

/**
 * Parameters for withdrawing funds from gas tank
 */
export type WithdrawFromGasTankParams = {
  /**
   * The chainId of the gas tank
   * @example 1 // ETH
   */
  chainId: number
  /**
   * The token address of asset supported in the gas tank
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  tokenAddress: Address
  /**
   * The amount to withdraw from gas tank
   * @example "1000"
   */
  amount: bigint
  /**
   * The address where the tokens to be sent
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  receiverAddress: Address
  /**
   * The private key of the gas tank
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  privateKey: Hex
}

/**
 * Response payload of withdraw funds from gas tank
 */
export type WithdrawFromGasTankPayload = {
  /**
   * The status of withdrawal
   * @example true
   */
  status: boolean
}

export const withdrawFromGasTank = async (
  _client: BaseMeeClient,
  _parameters: WithdrawFromGasTankParams
): Promise<WithdrawFromGasTankPayload> => {
  return {
    status: true
  }
}

export default withdrawFromGasTank
