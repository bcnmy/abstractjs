import {
  type MEEVersionConfig,
  semverCompare
} from "../../account/utils/getVersion"
import {
  DEFAULT_CONFIGURATIONS_BY_MEE_VERSION,
  type LegacyMEEVersion,
  type MEEVersion,
  SAFE_MEE_VERSIONS,
  type SafeMEEVersion
} from "../../constants"

const MIGRATION_GUIDE = "https://docs.biconomy.io/upgrade-migrate"

function lookup(meeVersion: MEEVersion): MEEVersionConfig {
  if (meeVersion in DEFAULT_CONFIGURATIONS_BY_MEE_VERSION) {
    return DEFAULT_CONFIGURATIONS_BY_MEE_VERSION[meeVersion]
  }

  // Sort the available versions in descending order for the error message
  const allVersions = Object.keys(DEFAULT_CONFIGURATIONS_BY_MEE_VERSION).sort(
    (a, b) => semverCompare(b, a)
  )

  throw new Error(
    `Unsupported MEE version: ${meeVersion}. Compatible versions are: ${allVersions.join(
      ", "
    )}`
  )
}

/**
 * Returns the configuration for a MEE version approved for creating new accounts.
 *
 * Only versions in {@link SAFE_MEE_VERSIONS} are accepted. Passing any other version
 * is a compile-time error, and is also rejected at runtime for JavaScript callers.
 *
 * To derive, deploy or upgrade an account that already exists on an earlier version,
 * use {@link getLegacyMEEVersion} instead.
 *
 * @param meeVersion - The MEE version to use for new accounts
 * @returns The configuration containing important smart contract addresses: Nexus implementation, validator, factory, and others
 * @throws Error if the version is not approved for new accounts
 */
export function getMEEVersion(meeVersion: SafeMEEVersion): MEEVersionConfig {
  if (!SAFE_MEE_VERSIONS.includes(meeVersion)) {
    throw new Error(
      `MEE version ${meeVersion} cannot be used to create new accounts. ` +
        `Use ${SAFE_MEE_VERSIONS.join(", ")}. ` +
        `To derive or upgrade an account that already exists on ${meeVersion}, ` +
        `use getLegacyMEEVersion("${meeVersion}") and see ${MIGRATION_GUIDE}.`
    )
  }

  return lookup(meeVersion)
}

/**
 * Returns the configuration for a MEE version that is no longer used for new accounts.
 *
 * An existing account's address is derived from the factory and bootstrap of the version
 * it was created with, so that version is required to compute the address again. Use this
 * to enumerate, deploy, sweep or upgrade accounts that already exist.
 *
 * Do not use this to create new accounts; use {@link getMEEVersion}.
 *
 * @param meeVersion - The MEE version the existing account was created with
 * @returns The configuration containing important smart contract addresses: Nexus implementation, validator, factory, and others
 * @throws Error if the version is not supported
 * @see {@link MIGRATION_GUIDE}
 */
export function getLegacyMEEVersion(
  meeVersion: LegacyMEEVersion
): MEEVersionConfig {
  return lookup(meeVersion)
}
