import { http, type Chain, type LocalAccount } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { beforeAll, describe, expect, inject, it } from "vitest"
import { type MultichainSmartAccount, toMultichainNexusAccount } from ".."
import { toNetwork } from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { DEFAULT_MEE_VERSION } from "../../constants"
import { getMEEVersion } from "../../modules"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

// @ts-ignore
const { runLifecycleTests } = inject("settings")

describe.runIf(runLifecycleTests)("mee.sponsorSupertransaction", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let chain: Chain
  let gasTankAccount: GasTankAccount

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
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    gasTankAccount = await toGasTankAccount({
      chainConfiguration: {
        transport: http(network.rpcUrl),
        chain,
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      },
      privateKey: generatePrivateKey()
    })
  })

  it("Fetch gas tank deployment status", async () => {
    const isDeployed = await gasTankAccount.isDeployed()
    expect(isDeployed).to.be.eq(false)
  })

  it("Sign normal quote to get sponsorship signed quote", async () => {
    const quote = await meeClient.getQuote({
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: chain.id
        }
      ],
      // This is actually not required for sponsorship request. To mock the singature util, I've added this here
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()

    const sponsoredQuote = await gasTankAccount.signSponsorship({ quote })

    expect(sponsoredQuote).toBeDefined()

    expect(sponsoredQuote.userOps[0].userOp.initCode).to.eq("0x")
    expect(sponsoredQuote.userOps[0].userOp.signature).toBeDefined()

    for (const meeUserOp of sponsoredQuote.userOps.slice(1)) {
      expect(meeUserOp.userOp.signature).not.toBeDefined()
    }
  })
})
