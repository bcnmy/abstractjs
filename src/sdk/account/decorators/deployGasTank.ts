import type { Address, Hex } from "viem"
import type { MeeClient } from "../../clients/createMeeClient"
import { waitForSupertransactionReceipt } from "../../clients/decorators/mee"
import type { MultichainSmartAccount } from "../toMultiChainNexusAccount"

/**
 * Parameters for deploying gas tank
 */
export type DeployGasTankParams = {
  /**
   * The chainId of the gas tank
   * @example 1 // ETH
   */
  chainId: number
  /**
   * The token to trasnfer while gas tank deployment
   * @example 0x88616f82B2668add07b6BF0aBa24E78Aa4660170
   */
  tokenAddress: Address
  /**
   * The amount to trasnfer while gas tank deployment
   * @example 1 // ETH
   */
  amount: bigint
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

export type GasTankDeployPayload = {
  /**
   * Deployment status
   * @example false
   */
  isDeployed: boolean
  /**
   * Address of the gas tank
   * @example 0x88616f82B2668add07b6BF0aBa24E78Aa4660170
   */
  address: Address
  /**
   * Deployment super transaction hash
   */
  hash?: Hex
}

export const deployGasTank = async (
  mcNexus: MultichainSmartAccount,
  parameters: DeployGasTankParams
): Promise<GasTankDeployPayload> => {
  const { chainId, amount, tokenAddress, meeClient, confirmations } = parameters

  const { isDeployed, address } = mcNexus.deploymentOn(chainId, true)

  const deployed = await isDeployed()

  if (deployed) {
    return { isDeployed: true, address }
  }

  const tranferInstruction = await mcNexus.build({
    type: "transfer",
    data: {
      recipient: address,
      amount,
      chainId,
      tokenAddress
    }
  })

  const fusionQuote = await meeClient.getFusionQuote({
    trigger: {
      amount,
      tokenAddress,
      chainId
    },
    instructions: [tranferInstruction],
    feeToken: {
      address: tokenAddress,
      chainId
    }
  })

  const { hash } = await meeClient.executeFusionQuote({
    fusionQuote
  })

  await waitForSupertransactionReceipt(meeClient, {
    hash,
    confirmations: confirmations || 2
  })

  return { isDeployed: true, address, hash }
}

export default deployGasTank
