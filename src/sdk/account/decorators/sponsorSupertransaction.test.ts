import { http, type Chain, type LocalAccount } from "viem"
import { generatePrivateKey } from "viem/accounts"
import { beforeAll, describe, expect, it } from "vitest"
import { type MultichainSmartAccount, toMultichainNexusAccount } from ".."
import { toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { testnetMcUSDC } from "../../constants"
import { type GasTankAccount, toGasTankAccount } from "../toGasTankAccount"

describe("mee.sponsorSupertransaction", () => {
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
      chains: [chain],
      transports: [http(network.rpcUrl)],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
    })

    gasTankAccount = await toGasTankAccount({
      transport: http(network.rpcUrl),
      chain,
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
        address: testnetMcUSDC.addressOn(chain.id),
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
