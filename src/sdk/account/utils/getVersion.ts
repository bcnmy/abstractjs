import type { Hex } from "viem"
import { DEFAULT_CONFIGURATIONS_BY_VERSION } from "../../constants"
import type { ToNexusSmartAccountParameters } from "../toNexusAccount"

/**
 * Retrieves the current version of the SDK from package.json
 *
 * This function provides access to the version number defined in the package.json file,
 * which can be useful for logging, debugging, or feature compatibility checks.
 *
 * @returns {string} The current version of the SDK
 *
 * @example
 * ```typescript
 * import { getVersion } from '@biconomy/abstractjs'
 *
 * console.log(`Using Biconomy SDK version: ${getVersion()}`)
 * ```
 */
export function getVersion(): string {
  try {
    // Using dynamic import with a relative path to the package.json
    // This works in both Node.js and bundled environments
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require("../../../../package.json")
    return packageJson.version
  } catch (error) {
    // Fallback in case the package.json cannot be loaded
    console.warn("Could not determine SDK version from package.json")
    return "unknown"
  }
}

/**
 * Compares two semantic version strings
 *
 * This function compares two semantic version strings (e.g., "1.2.3" and "1.3.0")
 * and determines their relative order.
 *
 * @param {string} a - First version string to compare
 * @param {string} b - Second version string to compare
 * @returns {number} Returns:
 *   - Negative number if version a is lower than version b
 *   - Zero if versions are equal
 *   - Positive number if version a is higher than version b
 *
 * @example
 * ```typescript
 * import { semverCompare } from '@biconomy/abstractjs'
 *
 * // Returns negative number (a < b)
 * semverCompare("1.2.3", "1.3.0")
 *
 * // Returns positive number (a > b)
 * semverCompare("2.0.0", "1.9.9")
 *
 * // Returns 0 (a === b)
 * semverCompare("1.2.3", "1.2.3")
 * ```
 */
export const semverCompare = (a: string, b: string): number => {
  const aParts = a.split(".").map((part) => Number.parseInt(part, 10))
  const bParts = b.split(".").map((part) => Number.parseInt(part, 10))

  // Ensure both arrays have the same length
  const maxLength = Math.max(aParts.length, bParts.length)
  while (aParts.length < maxLength) aParts.push(0)
  while (bParts.length < maxLength) bParts.push(0)

  for (let i = 0; i < maxLength; i++) {
    if (aParts[i] !== bParts[i]) {
      return aParts[i] - bParts[i]
    }
  }
  return 0
}

/**
 * Checks if a version meets or exceeds a required version
 *
 * This function determines if a given version is equal to or higher than
 * a required minimum version, which is useful for feature compatibility checks.
 *
 * @param {string} currentVersion - The version to check
 * @param {string} requiredVersion - The minimum required version
 * @returns {boolean} Returns true if currentVersion >= requiredVersion, false otherwise
 *
 * @example
 * ```typescript
 * import { versionMeetsRequirement } from '@biconomy/abstractjs'
 *
 * // Returns true (current version exceeds required)
 * versionMeetsRequirement("1.3.0", "1.2.0")
 *
 * // Returns false (current version below required)
 * versionMeetsRequirement("1.2.3", "1.3.0")
 *
 * // Returns true (versions are equal)
 * versionMeetsRequirement("1.2.3", "1.2.3")
 * ```
 */
export const versionMeetsRequirement = (
  currentVersion: string,
  requiredVersion: string
): boolean => {
  // Use the existing semverCompare function
  const comparison = semverCompare(currentVersion, requiredVersion)

  // Return true if currentVersion >= requiredVersion (comparison >= 0)
  return comparison >= 0
}

/**
 * Checks if a version is older than a specified version
 *
 * This function determines if a given version is lower than (comes before)
 * a specified version, which is useful for backward compatibility checks.
 *
 * @param {string} currentVersion - The version to check
 * @param {string} referenceVersion - The version to compare against
 * @returns {boolean} Returns true if currentVersion < referenceVersion, false otherwise
 *
 * @example
 * ```typescript
 * import { isVersionOlder } from '@biconomy/abstractjs'
 *
 * // Returns true (current version is older than reference)
 * isVersionOlder("1.2.0", "1.3.0")
 *
 * // Returns false (current version is newer than reference)
 * isVersionOlder("1.3.0", "1.2.3")
 *
 * // Returns false (versions are equal)
 * isVersionOlder("1.2.3", "1.2.3")
 * ```
 */
export const isVersionOlder = (
  currentVersion: string,
  referenceVersion: string
): boolean => {
  // Use the existing semverCompare function
  const comparison = semverCompare(currentVersion, referenceVersion)

  // Return true if currentVersion < referenceVersion (comparison < 0)
  return comparison < 0
}

export type AddressConfig = {
  attesters: Hex[]
  factoryAddress: Hex
  bootStrapAddress: Hex
  validatorAddress: Hex
}
/**
 * Returns the appropriate configuration based on the SDK version
 * @param version - The SDK version string (e.g., "0.2.0")
 * @returns The configuration containing attester and factory addresses
 * @throws Error if the version is not supported
 */
export function getConfigFromVersion(
  oldVersion: Required<NonNullable<ToNexusSmartAccountParameters["oldVersion"]>>
): AddressConfig {
  // If the version is explicitly provided in the DEFAULT_CONFIGURATIONS_BY_VERSION mapping
  if (oldVersion in DEFAULT_CONFIGURATIONS_BY_VERSION) {
    return DEFAULT_CONFIGURATIONS_BY_VERSION[oldVersion]
  }

  // If the version is not explicitly listed, find the closest compatible version
  // Sort the available versions in descending order
  const availableVersions = Object.keys(DEFAULT_CONFIGURATIONS_BY_VERSION).sort(
    (a, b) => semverCompare(b, a)
  )

  // Find the first version that is less than or equal to the requested version
  for (const availableVersion of availableVersions) {
    if (versionMeetsRequirement(oldVersion, availableVersion)) {
      return DEFAULT_CONFIGURATIONS_BY_VERSION[availableVersion]
    }
  }

  // If no compatible version is found, throw an error
  throw new Error(
    `Unsupported SDK version: ${oldVersion}. Compatible versions are: ${availableVersions.join(
      ", "
    )}`
  )
}
