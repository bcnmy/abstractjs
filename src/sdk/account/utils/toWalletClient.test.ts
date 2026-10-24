import { http, type Hex, createWalletClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { mainnet } from "viem/chains"
import { afterEach, describe, expect, it } from "vitest"
import { toSigner } from "./toSigner"
import { toWalletClient } from "./toWalletClient"

// Regression coverage for https://github.com/bcnmy/abstractjs/issues/212
//
// toWalletClient used to unconditionally build `custom(window?.ethereum)` when
// the unresolved signer's transport key was "custom". When a user connects
// without a wallet extension (e.g. a 3rd-party email / web2 connector),
// `window.ethereum` is undefined, and `custom(undefined)` produced a transport
// that threw "Cannot read properties of undefined (reading 'request')".
describe("utils.toWalletClient", () => {
  const account = privateKeyToAccount(
    "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex
  )

  afterEach(() => {
    // Clean up any injected provider stub between cases.
    if (typeof window !== "undefined") {
      // biome-ignore lint/performance/noDelete: test cleanup
      delete (window as { ethereum?: unknown }).ethereum
    }
  })

  it("does not throw when the signer is 'custom' but no injected provider exists", async () => {
    const resolvedSigner = await toSigner({ signer: account })
    // A wallet client whose transport key is "custom" simulates a browser signer.
    const unresolvedSigner = createWalletClient({
      account,
      chain: mainnet,
      transport: http()
    })
    // Force the "custom" transport key that selects the browser branch, while
    // leaving window.ethereum undefined (no extension installed).
    ;(unresolvedSigner as { transport: { key: string } }).transport.key =
      "custom"

    expect(() =>
      toWalletClient({
        unresolvedSigner: unresolvedSigner as never,
        resolvedSigner,
        chain: mainnet,
        transport: http()
      })
    ).not.toThrow()
  })

  it("falls back to the resolved signer account when there is no injected provider", async () => {
    const resolvedSigner = await toSigner({ signer: account })
    const unresolvedSigner = createWalletClient({
      account,
      chain: mainnet,
      transport: http()
    })
    ;(unresolvedSigner as { transport: { key: string } }).transport.key =
      "custom"

    const walletClient = toWalletClient({
      unresolvedSigner: unresolvedSigner as never,
      resolvedSigner,
      chain: mainnet,
      transport: http()
    })

    // Without window.ethereum the account is the full local signer, not just an
    // address routed through a (missing) injected provider.
    expect(walletClient.account.address).toBe(account.address)
  })
})
