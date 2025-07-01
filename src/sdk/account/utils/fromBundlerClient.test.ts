import { http, createPublicClient, createWalletClient } from "viem"
import { createBundlerClient } from "viem/account-abstraction"
import { privateKeyToAccount } from "viem/accounts"
import { mainnet } from "viem/chains"
import { describe, expect, it } from "vitest"
import { MAINNET_RPC_URLS } from "../../../test/testSetup"
import { toNexusAccount } from "../toNexusAccount"
import {
  type BundlerClientTypes,
  fromBundlerClientToChain,
  fromBundlerClientToChainId,
  fromBundlerClientToNexusAccount,
  fromBundlerClientToPublicClient,
  fromBundlerClientToSigner
} from "./fromBundlerClient"
import { toSigner } from "./toSigner"

describe("utils.fromBundlerClient", async () => {
  // Create real instances for testing
  const transport = http(MAINNET_RPC_URLS[mainnet.id])
  const publicClient = createPublicClient({
    chain: mainnet,
    transport
  })

  // Create a real wallet account
  const privateKey =
    "0x1234567890123456789012345678901234567890123456789012345678901234"
  const account = privateKeyToAccount(privateKey)

  // Create a real bundler client
  const bundlerClient = createBundlerClient({
    chain: mainnet,
    transport
  })

  // Create a real signer
  const signer = await toSigner({ signer: account })

  // Create a real Nexus account
  const nexusAccount = await toNexusAccount({
    chain: mainnet,
    signer,
    transport
  })

  // Attach the Nexus account to the bundler client
  const bundlerClientWithAccount = {
    ...bundlerClient,
    account: nexusAccount
  }

  describe("fromBundlerClientToPublicClient", () => {
    it("should extract public client successfully", () => {
      const result = fromBundlerClientToPublicClient(bundlerClientWithAccount)
      expect(result).toBe(nexusAccount.client)
      expect(result.chain.id).toBe(mainnet.id)
    })

    it("should throw error if nexus account is not found", () => {
      const invalidClient = {
        ...bundlerClient,
        account: { type: "invalid" }
      } as unknown as BundlerClientTypes

      expect(() => fromBundlerClientToPublicClient(invalidClient)).toThrow(
        "Nexus account not found"
      )
    })
  })

  describe("fromBundlerClientToNexusAccount", () => {
    it("should extract nexus account successfully", () => {
      const result = fromBundlerClientToNexusAccount(bundlerClientWithAccount)
      expect(result).toBe(nexusAccount)
      expect(result.type).toBe("smart")
    })

    it("should throw error if account type is not smart", () => {
      const invalidClient = {
        ...bundlerClient,
        account: { type: "eoa" }
      } as unknown as BundlerClientTypes

      expect(() => fromBundlerClientToNexusAccount(invalidClient)).toThrow(
        "Nexus account not found"
      )
    })
  })

  describe("fromBundlerClientToChain", () => {
    it("should extract chain successfully", () => {
      const result = fromBundlerClientToChain(bundlerClientWithAccount)
      expect(result.id).toBe(mainnet.id)
      expect(result.name).toBe(mainnet.name)
    })

    it("should throw error if chain is not found", () => {
      const invalidClient = {
        ...bundlerClientWithAccount,
        account: {
          ...nexusAccount,
          chain: {}
        }
      }

      expect(() => fromBundlerClientToChain(invalidClient)).toThrow(
        "Chain not found"
      )
    })
  })

  describe("fromBundlerClientToChainId", () => {
    it("should extract chain ID successfully", () => {
      const result = fromBundlerClientToChainId(bundlerClientWithAccount)
      expect(result).toBe(mainnet.id)
    })
  })

  describe("fromBundlerClientToSigner", () => {
    it("should extract signer successfully", () => {
      const result = fromBundlerClientToSigner(bundlerClientWithAccount)
      expect(result).toBe(nexusAccount.signer)
      expect(result.address).toBe(account.address)
    })
  })
})
