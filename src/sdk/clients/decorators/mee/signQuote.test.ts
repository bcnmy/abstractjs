import { type Chain, type LocalAccount, isHex } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type { FeeTokenInfo, Instruction } from "./getQuote"
import { signQuote } from "./signQuote"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { mcUSDC } from "../../../constants"

describe("mee.signQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = createMeeClient({ account: mcNexus })
  })

  test("should sign a quote", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      }
    ]

    expect(instructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions: instructions,
      feeToken
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(signedQuote.signature).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
  })
})
