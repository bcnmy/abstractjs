import type { Chain, Hex, LocalAccount } from "viem"
import { beforeAll, describe, expect, test, vi } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { execute } from "./execute"
import type { FeeTokenInfo, Instruction } from "./getQuote"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { mcUSDC } from "../../../constants/tokens"

vi.mock("./execute")

describe("mee.execute", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let feeToken: FeeTokenInfo

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = createMeeClient({ account: mcNexus })
  })

  test("should execute a quote using execute", async () => {
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
      }
    ]

    expect(instructions).toBeDefined()

    // Mock the execute function
    const mockExecuteResponse = { hash: "0x123" as Hex }
    // Mock implementation for this specific test
    vi.mocked(execute).mockResolvedValue(mockExecuteResponse)

    const { hash } = await execute(meeClient, {
      instructions: instructions,
      feeToken
    })

    expect(hash).toEqual(mockExecuteResponse.hash)

    expect(execute).toHaveBeenCalledWith(meeClient, {
      instructions: instructions,
      feeToken
    })
  })
})
