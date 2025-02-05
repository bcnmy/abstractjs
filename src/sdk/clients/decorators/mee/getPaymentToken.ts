import type { Address } from "viem/accounts"
import { addressEquals } from "../../../account/utils/Utils"
import type { BaseMeeClient } from "../../createMeeClient"
import { getGasToken } from "./getGasToken"

/**
 * Represents a payment token configuration
 */
export interface PaymentToken {
  /** Token name */
  name: string
  /** Token contract address */
  address: Address
  /** Token symbol */
  symbol: string
  /** Number of decimal places for the token */
  decimals: number
  /** Whether permit functionality is enabled for this token */
  permitEnabled: boolean
}

export type GetPaymentTokenParams = {
  /** The chain ID */
  chainId: number
  /** The address of the token */
  tokenAddress: Address
}

export type GetPaymentTokenPayload = PaymentToken

export const getPaymentToken = async (
  client: BaseMeeClient,
  parameters: GetPaymentTokenParams
): Promise<GetPaymentTokenPayload> => {
  const gasToken = await getGasToken(client, {
    chainId: parameters.chainId,
    address: parameters.tokenAddress
  })
  const paymentToken = gasToken.paymentTokens.find((paymentToken) =>
    addressEquals(paymentToken.address, parameters.tokenAddress)
  )
  if (!paymentToken) {
    throw new Error(
      `Payment token not found for chain ${parameters.chainId} and address ${parameters.tokenAddress}`
    )
  }
  return paymentToken
}
