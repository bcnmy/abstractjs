import { describe, expect, test } from "vitest"
import {
  DEFAULT_MEE_VERSION,
  MEEVersion,
  SAFE_MEE_VERSIONS
} from "../../constants"
import { getLegacyMEEVersion, getMEEVersion } from "./getMeeConfig"

/**
 * Only versions built on Nexus 1.3.3 may create new accounts.
 *
 * Version ordering does not imply safety: 2.3.0 and 3.0.0 sort above 2.2.3 but are
 * built on Nexus 1.3.1. Membership of the allowlist is therefore pinned to the
 * implementation address, verified on chain, rather than derived by comparison.
 */
const NEXUS_133_IMPLEMENTATION = "0x0000B1c01cB3b5770D8806f0D214d50131a08a5B"

describe("getMEEVersion", () => {
  test("every allowlisted version resolves to the Nexus 1.3.3 implementation", () => {
    expect(SAFE_MEE_VERSIONS.length).toBeGreaterThan(0)

    for (const version of SAFE_MEE_VERSIONS) {
      expect(getMEEVersion(version).implementationAddress).toBe(
        NEXUS_133_IMPLEMENTATION
      )
    }
  })

  test("the default version is allowlisted", () => {
    expect(SAFE_MEE_VERSIONS).toContain(DEFAULT_MEE_VERSION)
  })

  test("rejects versions that cannot create new accounts", () => {
    // @ts-expect-error V2_0_0 is not assignable to SafeMEEVersion — this is the
    // compile-time guard clients hit. The runtime throw covers JavaScript callers.
    expect(() => getMEEVersion(MEEVersion.V2_0_0)).toThrow(
      /cannot be used to create new accounts/
    )
  })

  test("the rejection points at the migration entry point", () => {
    // @ts-expect-error see above
    expect(() => getMEEVersion(MEEVersion.V2_2_1)).toThrow(
      /getLegacyMEEVersion/
    )
  })

  test("versions ordering above the allowlist are still rejected", () => {
    // 2.3.0 sorts above 2.2.3 but runs Nexus 1.3.1.
    // @ts-expect-error see above
    expect(() => getMEEVersion(MEEVersion.V2_3_0)).toThrow(
      /cannot be used to create new accounts/
    )
  })
})

describe("getLegacyMEEVersion", () => {
  test("resolves earlier versions so existing accounts stay derivable", () => {
    // An existing account's address comes from the factory of the version that
    // created it, so migration flows must be able to resolve these.
    expect(getLegacyMEEVersion(MEEVersion.V2_1_0).factoryAddress).toBe(
      "0x0000006648ED9B2B842552BE63Af870bC74af837"
    )
    expect(getLegacyMEEVersion(MEEVersion.V2_0_0).accountId).toBe(
      "biconomy.nexus.1.2.0"
    )
  })

  test("earlier versions resolve to a different factory than the current one", () => {
    // Why migration changes the account address rather than upgrading in place.
    const legacyFactory = getLegacyMEEVersion(MEEVersion.V2_1_0).factoryAddress
    const currentFactory = getMEEVersion(MEEVersion.V2_2_3).factoryAddress
    expect(legacyFactory).not.toBe(currentFactory)
  })
})
