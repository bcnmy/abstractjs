import {
  type AddressConfig,
  type NexusVersion,
  semverCompare
} from "../../account/utils/getVersion"
import {
  DEFAULT_CONFIGURATIONS_BY_NEXUS_VERSION,
  DEFAULT_NEXUS_VERSION
} from "../../constants"

/**
 * Returns the appropriate configuration based on the SDK version
 * @param version - The SDK version string (e.g., "0.2.0")
 * @returns The configuration containing attester and factory addresses
 * @throws Error if the version is not supported
 */
export function getNexus(
  nexusVersion: NexusVersion = DEFAULT_NEXUS_VERSION
): AddressConfig {
  // If the version is explicitly provided in the DEFAULT_CONFIGURATIONS_BY_VERSION mapping
  if (nexusVersion in DEFAULT_CONFIGURATIONS_BY_NEXUS_VERSION) {
    return DEFAULT_CONFIGURATIONS_BY_NEXUS_VERSION[nexusVersion]
  }

  // If the version is not explicitly listed, find the closest compatible version
  // Sort the available versions in descending order
  const allVersions = Object.keys(DEFAULT_CONFIGURATIONS_BY_NEXUS_VERSION).sort(
    (a, b) => semverCompare(b, a)
  )

  // If no compatible version is found, throw an error
  throw new Error(
    `Unsupported Nexus version: ${nexusVersion}. Compatible versions are: ${allVersions.join(
      ", "
    )}`
  )
}
