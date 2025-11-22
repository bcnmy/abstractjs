import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient,
  isHex
} from "viem"
import { optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { TESTNET_RPC_URLS, toNetwork } from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { versionIsAtLeast } from "../../../account/utils/getVersion"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type { Instruction } from "./getQuote"
import { getQuoteType } from "./getQuoteType"
import signQuote, {
  formatSignedQuotePayload,
  preparePersonalSignableQuotePayload,
  prepareTypedDataSignableQuotePayload
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
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_2_1)
        }
      ]
    })

    expect(chain.id).not.toEqual(optimismSepolia.id)

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
    expect(isHex(signedQuote.signature)).toEqual(true)
    expect(signedQuote.meeVersion).toEqual(DEFAULT_MEE_VERSION)
  })

  test("should sign a quote with modular signing functions for MEE < 2.2.1", async () => {
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
    expect(isHex(signedQuote.signature)).toEqual(true)
    expect(signedQuote.meeVersion).toEqual(DEFAULT_MEE_VERSION)

    const quoteType = await getQuoteType(meeClient, quote)
    expect(quoteType).toEqual("simple")

    // Manual signing
    const { signablePayload, metadata } =
      preparePersonalSignableQuotePayload(quote)

    const signedMessage = await walletClient.signMessage({
      account: eoaAccount,
      ...signablePayload
    })

    const manuallySignedQuote = formatSignedQuotePayload(
      quote,
      metadata,
      signedMessage,
      DEFAULT_MEE_VERSION
    )

    expect(manuallySignedQuote).toBeDefined()
    expect(isHex(manuallySignedQuote.signature)).toEqual(true)
    expect(manuallySignedQuote.meeVersion).toEqual(DEFAULT_MEE_VERSION)

    expect(signedQuote.signature).toEqual(manuallySignedQuote.signature)
  })

  test("should sign a quote with modular signing functions for MEE >= 2.2.1", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: optimismSepolia.id
      }
    ]

    expect(instructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions: instructions,
      feeToken: {
        chainId: optimismSepolia.id,
        address: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const signedQuote = await signQuote(meeClient, { quote })

    expect(signedQuote).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
    expect(versionIsAtLeast(signedQuote.meeVersion!, MEEVersion.V2_2_1)).toBe(
      true
    )

    const quoteType = await getQuoteType(meeClient, quote)
    expect(quoteType).toEqual("simple")

    // Manual signing with typed data
    const deployment = mcNexus.deploymentOn(optimismSepolia.id, true)
    const eip712Domain = deployment.eip712Domain

    console.log("eip712Domain", eip712Domain)

    expect(eip712Domain).toBeDefined()

    const { signablePayload, metadata } = prepareTypedDataSignableQuotePayload(
      quote,
      eip712Domain!
    )

    const signedTypedData =
      await deployment.signer.signTypedData(signablePayload)

    const manuallySignedQuote = formatSignedQuotePayload(
      quote,
      metadata,
      signedTypedData,
      MEEVersion.V2_2_1
    )

    expect(manuallySignedQuote).toBeDefined()
    expect(isHex(manuallySignedQuote.signature)).toEqual(true)
    expect(manuallySignedQuote.meeVersion).toEqual(MEEVersion.V2_2_1)

    expect(signedQuote.signature).toEqual(manuallySignedQuote.signature)
  })
})
