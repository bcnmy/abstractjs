import {
  type Chain,
  type LocalAccount,
  type Transport,
  zeroAddress
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getFusionQuote from "./getFusionQuote"
import type { FeeTokenInfo, InstructionLike } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

describe("mee.getFusionQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let trigger: Trigger

  const index = 56n // Randomly chosen index

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })

    trigger = {
      chainId: paymentChain.id,
      tokenAddress: mcUSDC.addressOn(paymentChain.id),
      amount: 1n
    }
  })

  test("should get a fusion quote", async () => {
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: paymentChain.id
          }
        })
      ],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect(fusionQuote.quote.paymentInfo.sender).toEqual(
      mcNexus.deploymentOn(paymentChain.id)?.address
    )
    expect(fusionQuote.quote.paymentInfo.token).toEqual(feeToken.address)
    expect(+fusionQuote.quote.paymentInfo.chainId).toEqual(paymentChain.id)
  })
})
