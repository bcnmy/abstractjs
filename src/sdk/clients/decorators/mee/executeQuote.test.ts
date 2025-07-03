import type { Chain, Hex, LocalAccount, Transport } from "viem"
import { base, baseSepolia, optimism } from "viem/chains"
import { beforeAll, describe, expect, test, vi } from "vitest"
import {
  getTestChainConfig,
  TEST_MEE_API_KEY,
  toNetwork
} from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import executeQuote from "./executeQuote"
import type { ExecuteSignedQuotePayload } from "./executeSignedQuote"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"

describe("mee.executeQuote", () => {
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
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: TEST_MEE_API_KEY
    })
  })

  test("should execute a quote using", async () => {
    // vi.mock("./executeQuote")
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
    const mockExecuteQuoteResponse: ExecuteSignedQuotePayload = {
      hash: "0x123" as Hex
    }
    // Mock implementation for this specific test
    vi.mocked(executeQuote).mockResolvedValue(mockExecuteQuoteResponse)

    const quote = await getQuote(meeClient, {
      instructions: instructions,
      feeToken
    })

    const executedQuote = await executeQuote(meeClient, { quote })

    expect(executedQuote).toEqual(mockExecuteQuoteResponse)
  })

  test.only("should always throw an error if the quote has an error", async () => {
    // vi.resetModules()
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 99999999999999999999999999999999n
          }
        ],
        chainId: 1
      }
    ]

    const quote = await getQuote(meeClient, {
      instructions: instructions,
      sponsorship: true
    })
    const res = await executeQuote(meeClient, { quote })
    console.log(res, "res", quote)
    await expect(res).rejects.toThrow()
  })
})
