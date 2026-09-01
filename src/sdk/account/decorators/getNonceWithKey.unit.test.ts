import { afterEach, describe, expect, it, vi } from "vitest"
import { getDefaultNonceKey } from "./getNonceWithKey"

// Regression for the nonce-collision bug: concurrently-built same-chain userOps
// must receive distinct default nonce keys. The previous Date.now()+setTimeout(1)
// scheme handed out duplicates whenever the wall clock did not advance between
// calls, producing duplicate nonces at quote construction.
describe("getDefaultNonceKey", () => {
  const account = "0x1111111111111111111111111111111111111111" as const

  afterEach(() => vi.restoreAllMocks())

  it("returns unique keys for concurrent calls even when the clock does not advance", async () => {
    // Freeze Date.now: the exact condition under which the old implementation
    // returned the same key (and therefore the same nonce) for every userOp.
    vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    const keys = await Promise.all(
      Array.from({ length: 50 }, () => getDefaultNonceKey(account, 8453))
    )
    expect(new Set(keys.map(String)).size).toBe(keys.length)
  })

  it("returns strictly increasing keys across sequential calls", async () => {
    const a = await getDefaultNonceKey(account, 10)
    const b = await getDefaultNonceKey(account, 10)
    expect(b > a).toBe(true)
  })
})
