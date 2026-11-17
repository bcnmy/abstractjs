import { type Hex, keccak256, recoverMessageAddress, toHex } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { describe, expect, test } from "vitest"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { MEEVersion } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetQuotePayload } from "./getQuote"
import signQuote from "./signQuote"

const CHAIN_ID = "10"
const sessionKey = privateKeyToAccount(generatePrivateKey())

// Offline stand-in for a multichain account: signQuote's session branch only needs the
// signer and the MEE version per chain.
const account = {
  signer: sessionKey,
  deploymentOn: () => ({ version: getMEEVersion(MEEVersion.V2_2_3) })
} as unknown as MultichainSmartAccount

const sessionDetails = { mode: "0x00", permissionId: "0x01" }

const userOp = (label: string, withSession: boolean) => ({
  chainId: CHAIN_ID,
  userOpHash: keccak256(toHex(label)),
  ...(withSession ? { sessionDetails } : {})
})

const quoteWith = (
  userOps: ReturnType<typeof userOp>[],
  sponsored: boolean
): GetQuotePayload =>
  ({
    hash: keccak256(toHex("supertx")),
    paymentInfo: { sponsored },
    userOps
  }) as unknown as GetQuotePayload

const sign = (quote: GetQuotePayload) =>
  signQuote({} as BaseMeeClient, { account, quote })

const signerOf = (hash: Hex, signature: Hex) =>
  recoverMessageAddress({ message: { raw: hash }, signature })

describe("signQuote: smart session signatures", () => {
  test("self-paid session use signs the payment userOp and the call userOp separately", async () => {
    const payment = userOp("payment", true)
    const call = userOp("call", true)

    const signed = await sign(quoteWith([payment, call], false))

    expect(signed.sessionSignatures?.map((s) => s.index)).toEqual([0, 1])
    const [paymentSig, callSig] = signed.sessionSignatures!
    expect(await signerOf(payment.userOpHash, paymentSig.signature)).toBe(
      sessionKey.address
    )
    expect(await signerOf(call.userOpHash, callSig.signature)).toBe(
      sessionKey.address
    )
    // Nodes that predate sessionSignatures read only `signature`: keep the first op's there
    expect(signed.signature).toBe(paymentSig.signature)
  })

  test("sponsored session use leaves the sponsor's payment userOp alone", async () => {
    const payment = userOp("sponsored payment", true)
    const call = userOp("call", true)

    const signed = await sign(quoteWith([payment, call], true))

    expect(signed.sessionSignatures?.map((s) => s.index)).toEqual([1])
    expect(signed.signature).toBe(signed.sessionSignatures![0].signature)
    expect(await signerOf(call.userOpHash, signed.signature as Hex)).toBe(
      sessionKey.address
    )
  })

  test("ignores userOps without session details", async () => {
    const payment = userOp("sponsored payment", false)
    const call = userOp("call", true)
    const other = userOp("other", false)

    const signed = await sign(quoteWith([payment, call, other], true))

    expect(signed.sessionSignatures?.map((s) => s.index)).toEqual([1])
  })
})
