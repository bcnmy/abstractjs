import type { Address, Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { Instruction } from "../../../clients/decorators/mee/getQuote"
import { mcUSDC } from "../../../constants/tokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import buildApprove from "./buildApprove"

describe("mee.buildApprove", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain
  let tokenAddress: Address

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(targetChain.id)
  })

  it("should build a trigger instruction", async () => {
    const instructions: Instruction[] = await buildApprove(
      { account: mcNexus, currentInstructions: [] },
      {
        chainId: targetChain.id,
        tokenAddress,
        amount: 100n
      }
    )

    expect([0, 1]).toContain(instructions.length)
  })
})
