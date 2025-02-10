import {
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  zeroAddress
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import type { FeeTokenInfo, Instruction } from "."
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getPermitQuote from "./getPermitQuote"

describe("mee.getPermitQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
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
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test("should resolve instructions", async () => {
    const trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n
    }
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
      },
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
    expect(instructions.length).toEqual(2)

    const quote = await getPermitQuote(meeClient, {
      trigger,
      instructions,
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const fusionQuote = await getPermitQuote(meeClient, {
      trigger: {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "intent",
          data: {
            amount: 1n,
            mcToken: mcUSDC,
            toChain: targetChain
          }
        }),
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
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    expect(fusionQuote.quote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect([3, 4].includes(fusionQuote.quote.userOps.length)).toBe(true) // 3 or 4 depending on if bridging is needed
  })
})
