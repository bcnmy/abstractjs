import type { Address, Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
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

  let tokenAddress: Address
  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  it("should build an approval instruction", async () => {
    const instructions: Instruction[] = await buildApprove(
      { account: mcNexus, currentInstructions: [] },
      {
        chainId: targetChain.id,
        tokenAddress,
        amount: 100n,
        spender: mcNexus.addressOn(targetChain.id, true)
      }
    )

    expect([0, 1]).toContain(instructions.length)
  })
})
