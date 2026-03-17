import {
  http,
  type Chain,
  type Hex,
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
import { SIG_TYPE_SIMPLE_P256 } from "../../../account/utils/Constants"
import { versionIsAtLeast } from "../../../account/utils/getVersion"
import { toP256Signer } from "../../../account/utils/toP256Signer"
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
    expect(signedQuote.meeVersions).toBeDefined()
    expect(signedQuote.meeVersions!.length).toEqual(1)
    expect(signedQuote.meeVersions![0].version.version).toEqual(
      DEFAULT_MEE_VERSION
    )
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
    expect(signedQuote.meeVersions).toBeDefined()
    expect(signedQuote.meeVersions!.length).toEqual(1)
    expect(signedQuote.meeVersions![0].version.version).toEqual(
      DEFAULT_MEE_VERSION
    )

    const quoteType = await getQuoteType(meeClient, quote)
    expect(quoteType).toEqual("simple")

    // Manual signing
    const { signablePayload, metadata } =
      preparePersonalSignableQuotePayload(quote)

    const signedMessage = await walletClient.signMessage({
      account: eoaAccount,
      ...signablePayload
    })

    // manually compose MeeVersionsWithChainId array
    const expectedMeeVersions = [
      {
        version: getMEEVersion(DEFAULT_MEE_VERSION),
        chainId: chain.id
      }
    ]
    const manuallySignedQuote = formatSignedQuotePayload(
      quote,
      metadata,
      signedMessage,
      expectedMeeVersions
    )

    expect(manuallySignedQuote).toBeDefined()
    expect(isHex(manuallySignedQuote.signature)).toEqual(true)
    expect(manuallySignedQuote.meeVersions).toBeDefined()
    expect(manuallySignedQuote.meeVersions!.length).toEqual(1)
    expect(manuallySignedQuote.meeVersions![0].version.version).toEqual(
      DEFAULT_MEE_VERSION
    )

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
    expect(signedQuote.meeVersions).toBeDefined()
    expect(signedQuote.meeVersions!.length).toEqual(1)
    expect(
      versionIsAtLeast(
        signedQuote.meeVersions![0].version.version,
        MEEVersion.V2_2_1
      )
    ).toBe(true)

    const quoteType = await getQuoteType(meeClient, quote)
    expect(quoteType).toEqual("simple")

    // Manual signing with typed data
    const deployment = mcNexus.deploymentOn(optimismSepolia.id, true)
    const eip712Domain = await deployment.getEip712Domain()

    expect(eip712Domain).toBeDefined()

    const { signablePayload, metadata } = prepareTypedDataSignableQuotePayload(
      quote,
      eip712Domain!
    )

    const signedTypedData =
      await deployment.signer.signTypedData(signablePayload)

    // manually compose MeeVersionsWithChainId array
    const expectedMeeVersions = [
      {
        version: getMEEVersion(MEEVersion.V2_2_1),
        chainId: optimismSepolia.id
      }
    ]
    const manuallySignedQuote = formatSignedQuotePayload(
      quote,
      metadata,
      signedTypedData,
      expectedMeeVersions
    )

    expect(manuallySignedQuote).toBeDefined()
    expect(isHex(manuallySignedQuote.signature)).toEqual(true)
    expect(manuallySignedQuote.meeVersions).toBeDefined()
    expect(manuallySignedQuote.meeVersions!.length).toEqual(1)
    expect(manuallySignedQuote.meeVersions![0].version.version).toEqual(
      MEEVersion.V2_2_1
    )

    expect(signedQuote.signature).toEqual(manuallySignedQuote.signature)
  })

  describe("P256 Signer Support", () => {
    let p256Signer: ReturnType<typeof toP256Signer>
    let p256McNexus: MultichainSmartAccount
    let p256MeeClient: MeeClient
    const p256TestPrivateKey: Hex =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

    beforeAll(async () => {
      p256Signer = toP256Signer(p256TestPrivateKey)

      p256McNexus = await toMultichainNexusAccount({
        signer: p256Signer,
        chainConfigurations: [
          {
            chain: chain,
            transport: http(network.rpcUrl),
            version: getMEEVersion(MEEVersion.V3_0_0)
          }
        ]
      })

      p256MeeClient = await createMeeClient({
        account: p256McNexus,
        apiKey: "mee_3ZhZhHx3hmKrBQxacr283dHt"
      })
    })

    test("should sign quote with P256 prefix and correct signature length", async () => {
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

      const quote = await p256MeeClient.getQuote({
        instructions: instructions,
        feeToken: {
          chainId: chain.id,
          address: testnetMcTestUSDCP.addressOn(chain.id)
        }
      })

      const signedQuote = await signQuote(p256MeeClient, { quote })

      expect(signedQuote).toBeDefined()
      expect(isHex(signedQuote.signature)).toEqual(true)

      // Verify P256 prefix (0x177eee10)
      expect(signedQuote.signature.startsWith(SIG_TYPE_SIMPLE_P256)).toBe(true)

      // Total signature length: 4 bytes prefix + 64 bytes P256 sig = 68 bytes
      // In hex: "0x" + 136 hex chars = 138 chars total
      expect(signedQuote.signature.length).toBe(138)

      // Extract and verify raw P256 signature (without prefix)
      const rawSignature = `0x${signedQuote.signature.slice(10)}` as Hex
      // P256 signature should be 64 bytes (128 hex chars + "0x" = 130)
      expect(rawSignature.length).toBe(130)
    })
  })
})
