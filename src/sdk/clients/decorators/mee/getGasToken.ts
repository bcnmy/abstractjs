import type { Address } from "viem/accounts"
import type { BaseMeeClient } from "../../createMeeClient"
import type { PaymentToken } from "./getPaymentToken"

export type GetGasTokenParams = {
  /** The chainId to use */
  chainId: number
  /** The address of the payment token to use */
  address: Address
}
/**
 * Represents supported gas tokens for a specific chain
 */
export type GetGasTokenPayload = {
  /** Chain identifier */
  chainId: string
  /** List of payment tokens accepted for gas fees */
  paymentTokens: PaymentToken[]
}

export const getGasToken = async (
  client: BaseMeeClient,
  parameters: GetGasTokenParams
): Promise<GetGasTokenPayload> => {
  const gasToken = client.info.supported_gas_tokens.find(
    (gasToken) => Number(gasToken.chainId) === Number(parameters.chainId)
  )
  if (!gasToken) {
    throw new Error(`Gas token not found for chain ${parameters.chainId}`)
  }
  return gasToken
}
