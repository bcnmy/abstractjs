import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient,
  isHex
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { testnetMcUSDC } from "../../../constants"
import {
  DEFAULT_STAGING_PATHFINDER_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import type { Instruction } from "./getQuote"
import { getQuoteType } from "./getQuoteType"
import {
  formatSignedQuotePayload,
  prepareSignableQuotePayload,
  signQuote
} from "./signQuote"

describe("mee.signQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain
  let walletClient: WalletClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    mcNexus = await toMultichainNexusAccount({
      chains: [chain],
      transports: [http(network.rpcUrl)],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      url: DEFAULT_STAGING_PATHFINDER_URL,
      apiKey: "mee_3ZhZhHx3hmKrBQxacr283dHt"
    })
  })

  test("should sign a quote", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: chain.id
      }
    ]

    expect(instructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions: instructions,
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(signedQuote.signature).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
  })

  test("should sign a quote with modular signing functions", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: chain.id
      }
    ]

    expect(instructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions: instructions,
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(signedQuote.signature).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)

    const quoteType = await getQuoteType(walletClient, quote)

    expect(quoteType).toEqual("simple")

    const { signablePayload, metadata } = prepareSignableQuotePayload(quote)

    const signedMessage = await walletClient.signMessage({
      account: eoaAccount,
      ...signablePayload
    })

    const manuallySignedQuote = formatSignedQuotePayload(
      quote,
      metadata,
      signedMessage
    )

    expect(manuallySignedQuote).toBeDefined()
    expect(manuallySignedQuote.signature).toBeDefined()
    expect(isHex(manuallySignedQuote.signature)).toEqual(true)

    expect(signedQuote.signature).toEqual(manuallySignedQuote.signature)
  })
})
