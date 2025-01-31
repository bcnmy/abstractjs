import type { Chain, Hex, LocalAccount } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import type { FeeTokenInfo, Instruction } from "."
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { mcUSDC } from "../../../constants/tokens/__AUTO_GENERATED__"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedPermitQuote } from "./executeSignedPermitQuote"
import { getPermitQuote } from "./getPermitQuote"
import { signPermitQuote } from "./signPermitQuote"

describe("mee.executeSignedPermitQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
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

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should execute a quote using executeSignedPermitQuote", async () => {
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

    const quote = await getPermitQuote(meeClient, {
      instructions,
      feeToken
    })

    const signedPermitQuote = await signPermitQuote(meeClient, { quote })

    const { hash } = await executeSignedPermitQuote(meeClient, {
      signedPermitQuote
    })

    console.log(hash)
  })
})
