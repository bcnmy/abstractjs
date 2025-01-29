import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import buildDefaultInstructions from "./buildDefaultInstructions"

describe("mee:buildDefaultInstructions", () => {
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

  it("should call the bridge with a unified balance", async () => {
    const instructions = await buildDefaultInstructions(
      {
        account: mcNexus
      },
      {
        chainId: targetChain.id,
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ]
      }
    )

    expect(instructions.length).toBeGreaterThan(0)
  })
})
