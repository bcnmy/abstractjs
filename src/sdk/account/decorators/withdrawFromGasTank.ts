import type { Address, Hex } from "viem"
import type { MeeClient } from "../../clients/createMeeClient"
import { waitForSupertransactionReceipt } from "../../clients/decorators/mee"
import type { RuntimeValue } from "../../modules"
import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"
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
   * @example "1000" or "Runtime Balance"
   */
  amount: bigint | RuntimeValue
  /**
   * The address where the tokens to be sent
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
   */
  recipient: Address
  /**
   * Mee client to interact with mee network
   */
  meeClient: MeeClient
  /**
   * Block confirmations for the gas tank deployment
   * @example 1
   */
  confirmations?: number
}

export type WithdrawFromGasTankPayload = {
  // Withdraw funds from Gas tank hash
  hash: Hex
}

export const withdrawFromGasTank = async (
  mcNexus: MultichainSmartAccount,
  parameters: WithdrawFromGasTankParams
): Promise<WithdrawFromGasTankPayload> => {
  const { tokenAddress, chainId, amount, recipient, meeClient, confirmations } =
    parameters

  const withdrawal = mcNexus.buildComposable({
    type: "withdrawal",
    data: {
      tokenAddress,
      amount,
      chainId,
      recipient
    }
  })

  const quote = await meeClient.getQuote({
    instructions: [withdrawal],
    feeToken: {
      chainId,
      address: tokenAddress
    }
  })

  const { hash } = await meeClient.executeQuote({ quote })

  await waitForSupertransactionReceipt(meeClient, {
    hash,
    confirmations: confirmations || 2
  })

  return { hash }
}

export default withdrawFromGasTank
