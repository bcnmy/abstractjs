import type { Address, Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { Instruction } from "../../../clients/decorators/mee/getQuote"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import buildApprove from "./buildApprove"
import buildBatch from "./buildBatch"
import buildWithdrawal from "./buildWithdrawal"

describe("mee.buildBatch", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address
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
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  it("should build a batch instruction", async () => {
    const instructions: Instruction[] = await buildBatch(
      { accountAddress: mcNexus.signer.address, currentInstructions: [] },
      {
        instructions: [
          buildApprove(
            { accountAddress: mcNexus.signer.address, currentInstructions: [] },
            {
              chainId: targetChain.id,
              tokenAddress,
              amount: 100n,
              spender: mcNexus.addressOn(targetChain.id, true)
            }
          ),
          buildWithdrawal(
            { accountAddress: mcNexus.signer.address, currentInstructions: [] },
            {
              chainId: targetChain.id,
              tokenAddress,
              amount: 1n
            }
          )
        ]
      }
    )

    expect(instructions[0].calls.length).toBe(2)
  })
})
