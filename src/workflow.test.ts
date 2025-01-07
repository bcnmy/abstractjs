import { type LocalAccount, zeroAddress } from "viem"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { baseSepolia, optimismSepolia, base, optimism } from "viem/chains"
import { describe, beforeAll, test, expect } from "vitest"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "./account-vendors"
import { buildMeeUserOp, buildCall } from "./workflow"

describe("userOps", async () => {
  let eoa: LocalAccount
  let mcNexusTestnet: MultichainSmartAccount
  let mcNexusMainnet: MultichainSmartAccount

  beforeAll(async () => {
    eoa = privateKeyToAccount(generatePrivateKey())

    mcNexusTestnet = await toMultichainNexusAccount({
      chains: [baseSepolia, optimismSepolia],
      signer: eoa
    })

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, optimism],
      signer: eoa
    })
  })

  test("should build a user op", () => {
    const uOp = buildMeeUserOp({
      calls: [{ to: zeroAddress, value: 0n, gasLimit: 50_000n }]
    })
    expect(uOp.calls.length).toEqual(1)
    const casted = uOp.on(optimism.id)
    expect(casted.chainId).toEqual(optimism.id)
  })

  test("should build a call", () => {
    const data = "0xabc"
    const value = 10n
    const gasLimit = 50_000n

    const call = buildCall({
      gasLimit: gasLimit,
      to: zeroAddress,
      value: value,
      data: data
    })
    expect(call.data).toEqual(data)
    expect(call.value).toEqual(value)
    expect(call.to).toEqual(zeroAddress)
    expect(call.gasLimit).toEqual(gasLimit)
  })
})
