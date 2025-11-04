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
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type { Instruction } from "./getQuote"
import { getQuoteType } from "./getQuoteType"
import signQuote, {
  formatSignedQuotePayload,
  preparePersonalSignableQuotePayload
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
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus,
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
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(Object.keys(signedQuote.signatures).length).toEqual(1)
    expect(signedQuote.signatures[chain.id]).toBeDefined()
    expect(isHex(signedQuote.signatures[chain.id].signature)).toEqual(true)
    expect(signedQuote.signatures[chain.id].meeVersion).toEqual(DEFAULT_MEE_VERSION)
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
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(signedQuote.signatures[chain.id]).toBeDefined()
    expect(isHex(signedQuote.signatures[chain.id].signature)).toEqual(true)
    expect(signedQuote.signatures[chain.id].meeVersion).toEqual(DEFAULT_MEE_VERSION)

    const quoteType = await getQuoteType(meeClient, quote)
    expect(quoteType).toEqual("simple")

    // Manual signing
    const { signablePayload, metadata } =
      preparePersonalSignableQuotePayload(quote)

    const signedMessage = await walletClient.signMessage({
      account: eoaAccount,
      ...signablePayload
    })

    const manuallySignedQuote = formatSignedQuotePayload(quote, metadata, {
      [chain.id]: { signature: signedMessage, meeVersion: DEFAULT_MEE_VERSION }
    })

    expect(manuallySignedQuote).toBeDefined()
    expect(manuallySignedQuote.signatures[chain.id]).toBeDefined()
    expect(isHex(manuallySignedQuote.signatures[chain.id].signature)).toEqual(true)

    expect(signedQuote.signatures[chain.id]).toEqual(
      manuallySignedQuote.signatures[chain.id]
    )
  })

  // TODO: add tests for multiple chains with different eip712 domains and mee versions

})
