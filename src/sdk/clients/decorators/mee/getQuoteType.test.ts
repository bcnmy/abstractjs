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
import { getQuoteType, isPermitTokenInfo } from "./getQuoteType"
import getSupportedFeeToken, {
  type GetSupportedFeeTokenPayload
} from "./getSupportedFeeToken"

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

  test("Should get quote type for simple quote params", async () => {
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

    expect(await getQuoteType(meeClient, quoteParam)).to.eq("simple")
  })

  test("Should get quote type for simple quote payload", async () => {
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

    expect(await getQuoteType(meeClient, quote)).to.eq("simple")
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

    expect(await getQuoteType(meeClient, quoteParams)).to.eq("permit")
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

    expect(await getQuoteType(meeClient, quote)).to.eq("permit")
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

    expect(await getQuoteType(meeClient, quoteParam)).to.eq("onchain")
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

    expect(await getQuoteType(meeClient, quote)).to.eq("onchain")
  })

  describe("isPermitTokenInfo", () => {
    test("Trigger token is permit enabled", async () => {
      const trigger = {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 1n
      }
      const isPermit = await isPermitTokenInfo(meeClient, trigger)
      expect(isPermit).to.be.true
    })

    test("Payment token specified + payment token same as the trigger token + permit not enabled", async () => {
      const trigger = {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id), // not permittable token
        chainId: chain.id,
        amount: 1n
      }
      const isPermit = await isPermitTokenInfo(meeClient, trigger)
      expect(isPermit).to.be.false
    })
  })
})
