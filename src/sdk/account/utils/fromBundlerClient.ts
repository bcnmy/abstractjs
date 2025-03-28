import type { PublicClient } from "viem"
import type { Client } from "viem"
import type { Transport } from "viem"
import type { Chain } from "viem"
import type { Account } from "viem"
import type { BundlerClient, SmartAccount } from "viem/account-abstraction"
import type { NexusClient } from "../../clients/createBicoBundlerClient"
import type { NexusAccount } from "../toNexusAccount"
import type { Signer } from "./toSigner"

/**
 * Union type representing all supported bundler client types
 * @typedef {BundlerClient | NexusClient | Client<Transport, Chain | undefined, Account>} BundlerClientTypes
 */
export type BundlerClientTypes =
  | BundlerClient
  | NexusClient
  | Client<Transport, Chain | undefined, SmartAccount | undefined>

/**
 * Extracts the PublicClient from a bundler client
 * @param {BundlerClientTypes} bundlerClient - The bundler client to extract from
 * @returns {PublicClient<Transport, Chain, Account>} The public client instance
 * @throws {Error} If the Nexus account is not found
 */
export const fromBundlerClientToPublicClient = (
  bundlerClient: BundlerClientTypes
): PublicClient<Transport, Chain, Account> => {
  const nexusAccount = fromBundlerClientToNexusAccount(bundlerClient)
  if (!nexusAccount.client) {
    throw new Error("Public client not found")
  }
  return nexusAccount.client as PublicClient<Transport, Chain, Account>
}

/**
 * Extracts the NexusAccount from a bundler client
 * @param {BundlerClientTypes} bundlerClient - The bundler client to extract from
 * @returns {NexusAccount} The Nexus account instance
 * @throws {Error} If the account is not a valid Nexus smart account
 */
export const fromBundlerClientToNexusAccount = (
  bundlerClient: BundlerClientTypes
): NexusAccount => {
  const nexusAccount = bundlerClient.account as NexusAccount
  if (!nexusAccount.type || nexusAccount.type !== "smart") {
    throw new Error("Nexus account not found")
  }
  return bundlerClient.account as NexusAccount
}

/**
 * Extracts the Chain information from a bundler client
 * @param {BundlerClientTypes} bundlerClient - The bundler client to extract from
 * @returns {Chain} The chain information
 * @throws {Error} If the chain information is not found
 */
export const fromBundlerClientToChain = (
  bundlerClient: BundlerClientTypes
): Chain => {
  const nexusAccount = fromBundlerClientToNexusAccount(bundlerClient)
  const chain = nexusAccount.chain
  if (!chain.id) {
    throw new Error("Chain not found")
  }
  return chain
}

/**
 * Extracts the chain ID from a bundler client
 * @param {BundlerClientTypes} bundlerClient - The bundler client to extract from
 * @returns {number} The chain ID
 * @throws {Error} If the chain information is not found
 */
export const fromBundlerClientToChainId = (
  bundlerClient: BundlerClientTypes
): number => {
  const chain = fromBundlerClientToChain(bundlerClient)
  if (!chain.id) {
    throw new Error("Chain ID not found")
  }
  return chain.id
}

/**
 * Extracts the Signer from a bundler client
 * @param {BundlerClientTypes} bundlerClient - The bundler client to extract from
 * @returns {Signer} The signer instance
 * @throws {Error} If the Nexus account is not found
 */
export const fromBundlerClientToSigner = (
  bundlerClient: BundlerClientTypes
): Signer => {
  const nexusAccount = fromBundlerClientToNexusAccount(bundlerClient)
  if (!nexusAccount.signer || !nexusAccount.signer.address) {
    throw new Error("Signer not found")
  }
  return nexusAccount.signer
}
