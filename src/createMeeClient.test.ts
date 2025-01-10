import { isHex, type Address, type Chain, type LocalAccount } from "viem"
import { base } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { initNetwork } from "../tests/config"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "./account-vendors"
import { createMeeClient, type MeeClient } from "./createMeeClient"

const runPaidTests = inject("runPaidTests")

describe("createMeeClient", async () => {
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Address
  let mcNexusMainnet: MultichainSmartAccount
  let meeClient: MeeClient

  beforeAll(async () => {
    const network = await initNetwork("NETWORK_FROM_ENV")
    eoa = network.eoa
    paymentChain = network.paymentChain
    paymentToken = network.paymentToken

    mcNexusMainnet = await toMultichainNexusAccount({
      chains: [base, paymentChain],
      signer: eoa
    })

    meeClient = createMeeClient({ account: mcNexusMainnet })
  })

  test("should instantiate a client", async () => {
    const meeClient = createMeeClient({ account: mcNexusMainnet })
    expect(meeClient).toBeDefined()
    expect(meeClient.request).toBeDefined()
    expect(Object.keys(meeClient)).toContain("request")
    expect(Object.keys(meeClient)).toContain("account")
    expect(Object.keys(meeClient)).toContain("getQuote")
  })

  test("should extend meeClient with decorators", () => {
    expect(meeClient).toBeDefined()
    expect(meeClient.getQuote).toBeDefined()
    expect(meeClient.request).toBeDefined()
    expect(meeClient.account).toBeDefined()
    expect(meeClient.getQuote).toBeDefined()
    expect(meeClient.signQuote).toBeDefined()
    expect(meeClient.executeSignedQuote).toBeDefined()
  })

  test("should get a quote", async () => {
    const meeClient = createMeeClient({ account: mcNexusMainnet })

    const quote = await meeClient.getQuote({
      superTransaction: [],
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
    const quote = await meeClient.getQuote({
      superTransaction: [
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

    const signedQuote = await meeClient.signQuote({ quote })

    expect(signedQuote).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
  })

  test
    .runIf(runPaidTests)
    .skip("should execute a quote by getting it, signing it, and then executing the signed quote", async () => {
      const quote = await meeClient.getQuote({
        superTransaction: [
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

      const signedQuote = await meeClient.signQuote({ quote })

      const executeeQuote = await meeClient.executeSignedQuote({
        signedQuote
      })

      expect(executeeQuote).toBeDefined()
      expect(executeeQuote.hash).toBeDefined()
      expect(isHex(executeeQuote.hash)).toEqual(true)
    })

  test.runIf(runPaidTests)(
    "should execute a quote with a single call, and wait for the receipt",
    async () => {
      console.time("execute:hashTimer")
      console.time("execute:receiptTimer")
      const { hash } = await meeClient.execute({
        superTransaction: [
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
      const receipt = await meeClient.waitForSuperTransactionReceipt({
        hash
      })
      console.timeEnd("execute:receiptTimer")
      expect(receipt).toBeDefined()
      console.log(Object.values(receipt.explorerLinks))
    }
  )
})
