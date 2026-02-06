import { http, type LocalAccount, parseUnits } from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { toNetwork } from "../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../test/testTokens"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  DEFAULT_MEE_VERSION,
  SPENDING_LIMITS_POLICY_ADDRESS,
  SUDO_POLICY_ADDRESS,
  TIME_FRAME_POLICY_ADDRESS,
  UNIVERSAL_ACTION_POLICY_ADDRESS,
  USAGE_LIMIT_POLICY_ADDRESS
} from "../../constants"
import { getMEEVersion } from "../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../toMultiChainNexusAccount"
import { calldataArgument } from "./buildActionPolicy"

describe("mee.buildActionPolicy", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: network.chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })
  })

  it("Build sudo policy", async () => {
    const sudoPolicy = mcNexus.buildActionPolicy({ type: "sudo" })

    expect(sudoPolicy).toBeDefined()
    expect(sudoPolicy.policy).to.eq(SUDO_POLICY_ADDRESS)
  })

  it("Build timeframe policy", async () => {
    const now = Math.floor(Date.now() / 1000)
    const validAfter = now
    const validUntil = now + 3600

    const timeframePolicy = mcNexus.buildActionPolicy({
      type: "timeframe",
      validAfter,
      validUntil
    })

    expect(timeframePolicy).toBeDefined()
    expect(timeframePolicy.policy).to.eq(TIME_FRAME_POLICY_ADDRESS)
  })

  it("Build usage limit policy", async () => {
    const usageLimit = 5n

    const usagePolicy = mcNexus.buildActionPolicy({
      type: "usageLimit",
      limit: usageLimit
    })

    expect(usagePolicy).toBeDefined()
    expect(usagePolicy.policy).to.eq(USAGE_LIMIT_POLICY_ADDRESS)
  })

  it("Build spending limits policy", async () => {
    const testToken = testnetMcTestUSDCP.addressOn(network.chain.id)
    const limit = 1000000n

    const spendingLimitsPolicy = mcNexus.buildActionPolicy({
      type: "spendingLimits",
      tokenLimits: [{ token: testToken, limit }]
    })

    expect(spendingLimitsPolicy).toBeDefined()
    expect(spendingLimitsPolicy.policy).to.eq(SPENDING_LIMITS_POLICY_ADDRESS)
  })

  it("Build universal policy", async () => {
    const universalPolicy = mcNexus.buildActionPolicy({
      type: "universal",
      rules: [
        {
          condition: "equal",
          calldataOffset: calldataArgument(2),
          comparisonValue: parseUnits("10", 6)
        }
      ]
    })

    expect(universalPolicy).toBeDefined()
    expect(universalPolicy.policy).to.eq(UNIVERSAL_ACTION_POLICY_ADDRESS)
  })
})
