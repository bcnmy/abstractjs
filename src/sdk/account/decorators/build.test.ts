import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { mcUSDC } from "../../constants/tokens"
import { getMEEVersion } from "../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { build } from "./build"

describe("mee.build", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  it("should use the default option while building instructions", async () => {
    const instructions = await build(
      { account: mcNexus },
      {
        type: "default",
        data: {
          calls: [
            {
              to: "0x0000000000000000000000000000000000000000",
              gasLimit: 50000n,
              value: 0n
            }
          ],
          chainId: targetChain.id
        }
      }
    )

    expect(instructions).toMatchInlineSnapshot(`
      [
        {
          "calls": [
            {
              "gasLimit": 50000n,
              "to": "0x0000000000000000000000000000000000000000",
              "value": 0n,
            },
          ],
          "chainId": ${targetChain.id},
        },
      ]
    `)
    expect(instructions.length).toBeGreaterThan(0)
  })

  it("should use the bridge action while building instructions", async () => {
    const currentInstructions = await build(
      { account: mcNexus },
      {
        type: "intent",
        data: {
          amount: 1n,
          mcToken: mcUSDC,
          toChain: targetChain
        }
      }
    )

    const instructions = await build(
      { account: mcNexus, currentInstructions },
      {
        type: "default",
        data: {
          calls: [
            {
              to: "0x0000000000000000000000000000000000000000",
              gasLimit: 50000n,
              value: 0n
            }
          ],
          chainId: targetChain.id
        }
      }
    )

    expect([1, 2]).toContain(instructions.length)
    if (instructions.length === 1) return
    expect(instructions[0].calls.length).toBe(2) // Bridge instructions generates two calls
    expect(instructions[1].calls.length).toBe(1) // Default instruction in this case generates one call
  })
})
