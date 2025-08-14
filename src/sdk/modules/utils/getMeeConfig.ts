import {
  type MEEVersionConfig,
  semverCompare
} from "../../account/utils/getVersion"
import {
  DEFAULT_CONFIGURATIONS_BY_MEE_VERSION,
  type MEEVersion
} from "../../constants"

/**
 * Returns the appropriate configuration based on the SDK version
 * @param version - The SDK version string (e.g., "0.2.0")
 * @returns The configuration containing important smart contract addresses: Nexus implementation, validator, factory, and others
 * @throws Error if the version is not supported
 */
export function getMEEVersion(meeVersion: MEEVersion): MEEVersionConfig {
  // If the version is explicitly provided in the DEFAULT_CONFIGURATIONS_BY_VERSION mapping
  if (meeVersion in DEFAULT_CONFIGURATIONS_BY_MEE_VERSION) {
    return DEFAULT_CONFIGURATIONS_BY_MEE_VERSION[meeVersion]
  }

  // If the version is not explicitly listed, find the closest compatible version
  // Sort the available versions in descending order
  const allVersions = Object.keys(DEFAULT_CONFIGURATIONS_BY_MEE_VERSION).sort(
    (a, b) => semverCompare(b, a)
  )

  // If no compatible version is found, throw an error
  throw new Error(
    `Unsupported MEE version: ${meeVersion}. Compatible versions are: ${allVersions.join(
      ", "
    )}`
  )
}
