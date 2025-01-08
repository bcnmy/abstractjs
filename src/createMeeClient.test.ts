import { isHex, type Address, type Chain, type LocalAccount } from "viem"
import { base } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { initNetwork } from "../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "./account-vendors"
import { type BaseMeeClient, createMeeClient } from "./createMeeClient"
import { meeActions } from "./decorators"
import { getExplorerTxLink } from "./utils/explorer/explorer"

const runPaidTests = inject("runPaidTests")

describe("createMeeClient", async () => {
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount
  let meeClient: BaseMeeClient

  beforeAll(async () => {
    const network = await initNetwork("NETWORK_FROM_ENV")
    eoa = network.eoa
    paymentChain = network.paymentChain
    paymentToken = network.paymentToken

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })
  })

  test("should instantiate a client", async () => {
    meeClient = createMeeClient({ account: mcNexusMainnet })

    expect(meeClient).toBeDefined()
    expect(meeClient.request).toBeDefined()
    expect(Object.keys(meeClient)).toContain("request")
    expect(Object.keys(meeClient)).toContain("account")
    expect(Object.keys(meeClient)).not.toContain("getQuote")
  })

  test("should extend meeClient with decorators", () => {
    const extendedMeeClient = meeClient.extend(meeActions)
    expect(extendedMeeClient).toBeDefined()
    expect(extendedMeeClient.getQuote).toBeDefined()
    expect(extendedMeeClient.request).toBeDefined()
    expect(extendedMeeClient.account).toBeDefined()
    expect(extendedMeeClient.getQuote).toBeDefined()
    expect(extendedMeeClient.signQuote).toBeDefined()
    expect(extendedMeeClient.executeSignedQuote).toBeDefined()
  })

  test("should get a quote", async () => {
    const extendedMeeClient = meeClient.extend(meeActions)

    const quote = await extendedMeeClient.getQuote({
      instructions: [
        {
          calls: [
            {
              to: "0x0000000000000000000000000000000000000000",
              gasLimit: 50000n,
              value: 0n
            }
          ],
          chainId: 8453
        }
      ],
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).toEqual(
      mcNexusMainnet.deploymentOn(paymentChain.id).address
    )
    expect(quote.paymentInfo.token).toEqual(paymentToken)
    expect(+quote.paymentInfo.chainId).toEqual(paymentChain.id)
  })

  test("should sign a quote", async () => {
    const extendedMeeClient = meeClient.extend(meeActions)

    const quote = await extendedMeeClient.getQuote({
      instructions: [
        {
          calls: [
            {
              to: "0x0000000000000000000000000000000000000000",
              gasLimit: 50000n,
              value: 0n
            }
          ],
          chainId: 8453
        }
      ],
      feeToken: {
        address: paymentToken,
        chainId: paymentChain.id
      }
    })

    const signedQuote = await extendedMeeClient.signQuote({ quote })

    expect(signedQuote).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
  })

  test
    .runIf(runPaidTests)
    .skip("should execute a quote by getting it, signing it, and then executing the signed quote", async () => {
      const extendedMeeClient = meeClient.extend(meeActions)

      const quote = await extendedMeeClient.getQuote({
        instructions: [
          {
            calls: [
              {
                to: "0x0000000000000000000000000000000000000000",
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: 8453
          }
        ],
        feeToken: {
          address: paymentToken,
          chainId: paymentChain.id
        }
      })

      const signedQuote = await extendedMeeClient.signQuote({ quote })

      const executeeQuote = await extendedMeeClient.executeSignedQuote({
        signedQuote
      })

      expect(executeeQuote).toBeDefined()
      expect(executeeQuote.hash).toBeDefined()
      expect(isHex(executeeQuote.hash)).toEqual(true)
    })

  test.runIf(runPaidTests)(
    "should execute a quote with a single call",
    async () => {
      const extendedMeeClient = meeClient.extend(meeActions)

      console.time("execute:hashTimer")
      console.time("execute:receiptTimer")
      const { hash } = await extendedMeeClient.execute({
        instructions: [
          {
            calls: [
              {
                to: "0x0000000000000000000000000000000000000000",
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: 8453
          }
        ],
        feeToken: {
          address: paymentToken,
          chainId: paymentChain.id
        }
      })

      expect(hash).toBeDefined()
      console.timeEnd("execute:hashTimer")
      const receipt = await extendedMeeClient.waitForSuperTransactionReceipt({
        hash
      })
      console.timeEnd("execute:receiptTimer")
      expect(receipt).toBeDefined()
      console.log(Object.values(receipt.explorerLinks))
    }
  )
})
