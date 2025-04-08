import type { Chain, LocalAccount, Transport } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
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
import buildIntent from "./buildIntent"

describe("mee.buildIntent", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

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
  })

  it("should highlight building intent instructions", async () => {
    const instructions: Instruction[] = await buildIntent(
      { account: mcNexus },
      {
        amount: 1000000n,
        mcToken: mcUSDC,
        toChain: targetChain
      }
    )

    expect([1, 0]).toContain(instructions.length)
  })

  it("should highlight building optimistic intent instructions", async () => {
    const newMcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: privateKeyToAccount(generatePrivateKey())
    })

    const instructions: Instruction[] = await buildIntent(
      { account: newMcNexus },
      {
        amount: 1000000n,
        mcToken: mcUSDC,
        toChain: paymentChain,
        mode: "OPTIMISTIC"
      }
    )

    expect(instructions.length).toBe(1)
    expect(instructions[0].calls.length).toBe(2)
  })
})
