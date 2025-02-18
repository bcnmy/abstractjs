import { type Chain, type LocalAccount, type Transport, parseEther } from "viem"
import { base, optimism } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  type MultichainSmartAccount,
  buildApprove,
  buildTransferFrom,
  toMultichainNexusAccount
} from ".."
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import { mcUSDC } from "../../constants/tokens"
import { partitionInstructions } from "./partitionInstructions"

describe("utils.partitionInstructions", () => {
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

  test("should partition instructions into an initial batch and remaining instructions", async () => {
    const instructions = [
      buildApprove(
        {
          account: mcNexus
        },
        {
          chainId: base.id,
          tokenAddress: mcUSDC.addressOn(base.id),
          spender: mcNexus.addressOn(base.id, true),
          amount: parseEther("1.0")
        }
      ),
      buildApprove(
        {
          account: mcNexus
        },
        {
          chainId: optimism.id,
          tokenAddress: mcUSDC.addressOn(optimism.id),
          spender: mcNexus.addressOn(optimism.id, true),
          amount: parseEther("1.0")
        }
      )
    ]

    const triggerCall: Instruction[] = await buildTransferFrom(
      { account: mcNexus },
      {
        chainId: base.id,
        tokenAddress: mcUSDC.addressOn(base.id),
        amount: 100n,
        recipient: mcNexus.addressOn(base.id, true),
        sender: eoaAccount.address
      }
    )

    const partitionedInstructions = await partitionInstructions({
      account: mcNexus,
      triggerCall,
      instructions
    })

    expect(partitionedInstructions).toHaveLength(2)
    expect(partitionedInstructions[0].chainId).toBe(base.id)
    expect(partitionedInstructions[1].chainId).toBe(optimism.id)
    expect(partitionedInstructions[0].calls).toHaveLength(2)
    expect(partitionedInstructions[1].calls).toHaveLength(1)
  })
})
