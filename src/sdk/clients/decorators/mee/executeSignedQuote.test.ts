import type { Chain, Hex, LocalAccount, Transport } from "viem"
import { beforeAll, describe, expect, test, vi } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens/__AUTO_GENERATED__"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import type { FeeTokenInfo, Instruction } from "./getQuote"
import { signQuote } from "./signQuote"
vi.mock("./executeSignedQuote")

describe("mee.executeSignedQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
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

  test("should execute a quote using executeSignedQuote", async () => {
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

    // Mock the executeSignedQuote function
    const mockExecuteResponse = { hash: "0x123" as Hex }
    // Mock implementation for this specific test
    vi.mocked(executeSignedQuote).mockResolvedValue(mockExecuteResponse)

    const quote = await meeClient.getQuote({
      instructions,
      feeToken
    })

    const signedQuote = await signQuote(meeClient, { quote })

    const { hash } = await executeSignedQuote(meeClient, {
      signedQuote
    })

    expect(hash).toEqual(mockExecuteResponse.hash)

    expect(executeSignedQuote).toHaveBeenCalledWith(meeClient, {
      signedQuote
    })
  })
})
