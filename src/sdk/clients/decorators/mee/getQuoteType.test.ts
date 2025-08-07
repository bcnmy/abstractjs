import { http, type Chain, type LocalAccount, createWalletClient } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import type { GetFusionQuoteParams, GetQuoteParams } from "."
import { toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION, testnetMcUSDC } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getPaymentToken, { type GetPaymentTokenPayload } from "./getPaymentToken"
import { getQuoteType } from "./getQuoteType"

describe("mee.getQuoteType", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

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

  test("Should get quote type for normal quote params", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quoteParam: GetQuoteParams = {
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    }

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    expect(await getQuoteType(walletClient, quoteParam)).to.eq("simple")
  })

  test("Should get quote type for normal quote payload", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    expect(await getQuoteType(walletClient, quote)).to.eq("simple")
  })

  test("Should get quote type for permit quote param", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quoteParams: GetFusionQuoteParams = {
      trigger: {
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      },
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    }

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    let paymentTokenInfo: GetPaymentTokenPayload | undefined = undefined

    if (quoteParams.trigger.tokenAddress) {
      paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: quoteParams.trigger.tokenAddress,
        chainId: quoteParams.trigger.chainId
      })
    }

    expect(
      await getQuoteType(walletClient, quoteParams, paymentTokenInfo)
    ).to.eq("permit")
  })

  test("Should get quote type for permit quote payload", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      },
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    let paymentTokenInfo: GetPaymentTokenPayload | undefined = undefined

    if (quote.trigger.tokenAddress) {
      paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: quote.trigger.tokenAddress,
        chainId: quote.trigger.chainId
      })
    }

    expect(await getQuoteType(walletClient, quote, paymentTokenInfo)).to.eq(
      "permit"
    )
  })

  test("Should get quote type for onchain quote param", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: "0xb394e82fd251de530c9d71cbee9527a4cf690e57",
        amount: 1n,
        chainId: chain.id
      }
    })

    const quoteParam: GetFusionQuoteParams = {
      trigger: {
        tokenAddress: "0xb394e82fd251de530c9d71cbee9527a4cf690e57",
        chainId: chain.id,
        amount: 1n
      },
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: "0xb394e82fd251de530c9d71cbee9527a4cf690e57"
      }
    }

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    let paymentTokenInfo: GetPaymentTokenPayload | undefined = undefined

    if (quoteParam.trigger.tokenAddress) {
      paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: quoteParam.trigger.tokenAddress,
        chainId: quoteParam.trigger.chainId
      })
    }
    expect(
      await getQuoteType(walletClient, quoteParam, paymentTokenInfo)
    ).to.eq("onchain")
  })

  test("Should get quote type for onchain quote payload", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: "0xb394e82fd251de530c9d71cbee9527a4cf690e57",
        amount: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: "0xb394e82fd251de530c9d71cbee9527a4cf690e57",
        chainId: chain.id,
        amount: 1n
      },
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: "0xb394e82fd251de530c9d71cbee9527a4cf690e57"
      }
    })

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })

    let paymentTokenInfo: GetPaymentTokenPayload | undefined = undefined

    if (quote.trigger.tokenAddress) {
      paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: quote.trigger.tokenAddress,
        chainId: quote.trigger.chainId
      })
    }
    expect(await getQuoteType(walletClient, quote, paymentTokenInfo)).to.eq(
      "onchain"
    )
  })
})
