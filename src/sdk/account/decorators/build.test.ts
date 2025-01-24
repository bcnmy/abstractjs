import type { Chain, LocalAccount } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChains, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { mcUSDC } from "../../constants/tokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { build } from "./build"

describe("mee:build", () => {
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

    meeClient = createMeeClient({ account: mcNexus })
  })

  it("should use the base option while building instructions", async () => {
    const instructions = await build(
      { account: mcNexus },
      {
        type: "default",
        data: {
          instructions: [
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
          amount: BigInt(1000),
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
          instructions: [
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
        }
      }
    )

    expect([1, 2]).toContain(instructions.length)
    if (instructions.length === 1) return
    expect(instructions[0].calls.length).toBe(2) // Bridge instructions generates two calls
    expect(instructions[1].calls.length).toBe(1) // Default instruction in this case generates one call
  })
})
