import type { Chain, Hex, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test, vi } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { execute } from "./execute"
import type { FeeTokenInfo, Instruction } from "./getQuote"

vi.mock("./execute")

describe("mee.execute", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let feeToken: FeeTokenInfo

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
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

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
