import { http, type LocalAccount } from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { TESTNET_RPC_URLS, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import { DEFAULT_MEE_VERSION, getSmartSessionsValidator } from "../../constants"
import { getMEEVersion } from "../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"

describe("mee.multichainRead", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  it("should check if smartSessions module is installed for base sepolia", async () => {
    const readResults = await mcNexus.read<boolean>({
      type: "toIsModuleInstalledReads",
      parameters: getSmartSessionsValidator({})
    })
    expect(readResults[0]).toBeTypeOf("boolean")
  })
})
