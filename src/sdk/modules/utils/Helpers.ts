import {
  type Address,
  type ByteArray,
  type Chain,
  type Client,
  type Hex,
  type Transport,
  type WalletClient,
  isHex,
  pad,
  publicActions,
  toFunctionSelector,
  toHex
} from "viem"
import { ERROR_MESSAGES } from "../../account/index.js"
import type { AnyData, ModularSmartAccount } from "./Types.js"

/**
 * Represents a hardcoded hex value reference.
 * Used when you want to bypass automatic hex conversion.
 */
export type HardcodedReference = {
  /** The raw hex value */
  raw: Hex
}

/**
 * Base types that can be converted to hex references.
 */
type BaseReferenceValue = string | number | bigint | boolean | ByteArray

/**
 * Union type of all possible reference values that can be converted to hex.
 * Includes both basic types and hardcoded references.
 */
export type AnyReferenceValue = BaseReferenceValue | HardcodedReference

/**
 * Parses a reference value into a 32-byte hex string.
 * Handles various input types including Ethereum addresses, numbers, booleans, and raw hex values.
 *
 * @param referenceValue - The value to convert to hex
 * @returns A 32-byte hex string (66 characters including '0x' prefix)
 *
 * @throws {Error} If the resulting hex string is invalid or not 32 bytes
 */
export function parseReferenceValue(referenceValue: AnyReferenceValue): Hex {
  let result: Hex
  // Handle 20-byte Ethereum address
  if (isHex(referenceValue) && referenceValue.length === 42) {
    // Remove '0x' prefix, pad to 32 bytes (64 characters) on the left, then add '0x' prefix back
    result = `0x${"0".repeat(24)}${referenceValue.slice(2)}` as Hex
  } else if ((referenceValue as HardcodedReference)?.raw) {
    result = (referenceValue as HardcodedReference)?.raw
  } else if (typeof referenceValue === "bigint") {
    result = pad(toHex(referenceValue), { size: 32 }) as Hex
  } else if (typeof referenceValue === "number") {
    result = pad(toHex(BigInt(referenceValue)), { size: 32 }) as Hex
  } else if (typeof referenceValue === "boolean") {
    result = pad(toHex(referenceValue), { size: 32 }) as Hex
  } else if (isHex(referenceValue)) {
    // review
    result = referenceValue
  } else if (typeof referenceValue === "string") {
    result = pad(referenceValue as Hex, { size: 32 })
  } else {
    // (typeof referenceValue === "object")
    result = pad(toHex(referenceValue as ByteArray), { size: 32 }) as Hex
  }
  if (!isHex(result) || result.length !== 66) {
    throw new Error(ERROR_MESSAGES.INVALID_HEX)
  }
  return result
}

/**
 * Extracts and validates the active module from a client's account.
 *
 * @param client - The viem Client instance with an optional modular smart account
 * @returns The active module from the account
 *
 * @throws {Error} If no module is currently activated
 */
export const parseModule = <
  TModularSmartAccount extends ModularSmartAccount | undefined,
  chain extends Chain | undefined
>(
  client: Client<Transport, chain, TModularSmartAccount>
): AnyData => {
  const activeModule = client?.account?.getModule()
  if (!activeModule) {
    throw new Error(ERROR_MESSAGES.MODULE_NOT_ACTIVATED)
  }
  return activeModule
}

export const isPermitSupported = async (
  walletClient: WalletClient,
  tokenAddress: Address
): Promise<boolean> => {
  try {
    const client = walletClient.extend(publicActions)

    // Define all selectors
    const permitSelector = toFunctionSelector(
      "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)"
    )
    const domainSeparatorSelector = "0x3644e515" // keccak256("DOMAIN_SEPARATOR()")
    const noncesSelector = "0x7ecebe00" // keccak256("nonces(address)")

    // Helper function to check function existence
    const checkPermitEnabled = async (
      selector: Hex,
      padding = ""
    ): Promise<boolean> => {
      return client
        .call({
          to: tokenAddress,
          data: `${selector}${padding}` as Hex
        })
        .then(() => true)
        .catch((error) => {
          // For permit function, we check if it's a revert due to params, not function missing
          if (selector === permitSelector) {
            return (
              error.message.includes("revert") &&
              !error.message.includes("function selector")
            )
          }
          return false
        })
    }

    // Create the calls to check for each function
    const [hasPermit, hasDomainSeparator, hasNonces] = await Promise.all([
      checkPermitEnabled(permitSelector, "0".repeat(64)),
      checkPermitEnabled(domainSeparatorSelector),
      checkPermitEnabled(
        noncesSelector,
        `000000000000000000000000${"0".repeat(40)}`
      )
    ])

    return hasPermit && hasDomainSeparator && hasNonces
  } catch (err) {
    console.error("Error checking permit support:", err)
    return false
  }
}
