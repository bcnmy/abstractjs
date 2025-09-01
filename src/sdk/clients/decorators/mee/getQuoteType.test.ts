import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import type { GetFusionQuoteParams, GetQuoteParams } from "."
import { toNetwork } from "../../../../test/testSetup"
import {
  testnetMcTestUSDC,
  testnetMcTestUSDCP
} from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getPaymentToken, { type GetPaymentTokenPayload } from "./getPaymentToken"
import { getQuoteType, isPermitTokenInfo } from "./getQuoteType"

describe("mee.getQuoteType", () => {
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

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  test("Should get quote type for normal quote params", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quoteParam: GetQuoteParams = {
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    }

    expect(await getQuoteType(walletClient, quoteParam)).to.eq("simple")
  })

  test("Should get quote type for normal quote payload", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    })

    expect(await getQuoteType(walletClient, quote)).to.eq("simple")
  })

  test("Should get quote type for permit quote param", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quoteParams: GetFusionQuoteParams = {
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      },
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
    }

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
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      },
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcTestUSDCP.addressOn(chain.id)
      }
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

  describe("isPermitTokenInfo", () => {
    test("Payment token not specified + arbitrary payment tokens supported", async () => {
      const paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: "0x00000000000000000000000000000000000a11ce",
        chainId: chain.id
      })
      paymentTokenInfo.isArbitraryPaymentTokensSupported = true
      expect(paymentTokenInfo.paymentToken).to.be.undefined

      const isPermit = await isPermitTokenInfo(walletClient, paymentTokenInfo, {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      })
      // if arbitrary payment tokens supported,
      // should return true for the trigger token that supports permit
      expect(isPermit).to.be.true
    })

    test("Payment token not specified + arbitrary payment tokens not supported", async () => {
      const paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: "0x00000000000000000000000000000000000a11ce",
        chainId: chain.id
      })

      paymentTokenInfo.isArbitraryPaymentTokensSupported = false
      expect(paymentTokenInfo.paymentToken).to.be.undefined

      const isPermit = await isPermitTokenInfo(walletClient, paymentTokenInfo, {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      })
      // if arbitrary payment tokens not supported,
      // should return false for the trigger token that supports permit
      expect(isPermit).to.be.false
    })

    test("Payment token specified + payment token different from the trigger token", async () => {
      const paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      })

      const trigger = {
        // not permittable token
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      }

      const isPermit = await isPermitTokenInfo(
        walletClient,
        paymentTokenInfo,
        trigger
      )
      // should be based on trigger token in this case and trigger token does not support permit
      expect(isPermit).to.be.false
    })

    test("Payment token specified + payment token same as the trigger token + permit enabled", async () => {
      const paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      })
      const trigger = {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      }
      const isPermit = await isPermitTokenInfo(
        walletClient,
        paymentTokenInfo,
        trigger
      )
      expect(isPermit).to.be.true
    })

    test("Payment token specified + payment token same as the trigger token + permit not enabled", async () => {
      const paymentTokenInfo = await getPaymentToken(meeClient, {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id), // not permittable token
        chainId: chain.id
      })

      const trigger = {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id), // not permittable token
        chainId: chain.id,
        amount: 1n
      }
      const isPermit = await isPermitTokenInfo(
        walletClient,
        paymentTokenInfo,
        trigger
      )
      expect(isPermit).to.be.false
    })
  })
})
