import {
  http,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient
} from "viem"
import { beforeAll, describe, it } from "vitest"
import { toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"

describe("mee.sponsorSupertransaction", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let chain: Chain
  let publicClient: PublicClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    publicClient = createPublicClient({
      chain,
      transport: http()
    })

    mcNexus = await toMultichainNexusAccount({
      chains: [chain],
      transports: [http()],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  it("test", async () => {})
})
