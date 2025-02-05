import type { Chain, LocalAccount } from "viem"
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
import buildTransferFrom from "./buildTransferFrom"

describe("mee.buildTransferFrom", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  it("should build a transferFrom instruction", async () => {
    const instructions: Instruction[] = await buildTransferFrom(
      { account: mcNexus, currentInstructions: [] },
      {
        chainId: targetChain.id,
        tokenAddress: mcUSDC.addressOn(targetChain.id),
        amount: 100n,
        recipient: mcNexus.addressOn(targetChain.id, true),
        sender: eoaAccount.address
      }
    )

    expect([0, 1]).toContain(instructions.length)
  })
})
