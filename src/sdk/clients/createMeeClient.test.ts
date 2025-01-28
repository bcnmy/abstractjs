import {
  type Chain,
  type LocalAccount,
  encodeFunctionData,
  erc20Abi,
  isHex,
  parseUnits,
  zeroAddress
} from "viem"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChains, toNetwork } from "../../test/testSetup"
import type { NetworkConfig } from "../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account/toMultiChainNexusAccount"
import { toFeeToken } from "../account/utils"
import { aave } from "../constants/protocols"
import { mcUSDC } from "../constants/tokens"
import { type MeeClient, createMeeClient } from "./createMeeClient"
import type { FeeTokenInfo } from "./decorators/mee/getQuote"
import type { SignFusionQuoteParams } from "./decorators/mee/signFusionQuote"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.createMeeClient", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let targetChain: Chain
  let paymentChain: Chain

  const index = 0n

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!

    feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

    mcNexus = await toMultichainNexusAccount({
      chains: [targetChain, paymentChain],
      signer: eoaAccount,
      index
    })

    meeClient = createMeeClient({ account: mcNexus })
  })

  test("should get a quote", async () => {
    const meeClient = createMeeClient({ account: mcNexus })

    const quote = await meeClient.getQuote({ instructions: [], feeToken })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).toEqual(
      mcNexus.deploymentOn(paymentChain.id)?.address
    )
    expect(quote.paymentInfo.token).toEqual(feeToken.address)
    expect(+quote.paymentInfo.chainId).toEqual(paymentChain.id)
  })

  test("should sign a quote", async () => {
    const quote = await meeClient.getQuote({
      instructions: [
        {
          calls: [
            {
              to: zeroAddress,
              gasLimit: 50000n,
              value: 0n
            }
          ],
          chainId: targetChain.id
        }
      ],
      feeToken
    })

    const signedQuote = await meeClient.signQuote({ quote })

    expect(signedQuote).toBeDefined()
    expect(isHex(signedQuote.signature)).toEqual(true)
  })

  test
    .runIf(runPaidTests)
    .skip("should execute a quote by getting it, signing it, and then executing the signed quote", async () => {
      const quote = await meeClient.getQuote({
        instructions: [
          {
            calls: [
              {
                to: zeroAddress,
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        ],
        feeToken
      })

      const signedQuote = await meeClient.signQuote({ quote })
      const executeeQuote = await meeClient.executeSignedQuote({ signedQuote })

      expect(executeeQuote).toBeDefined()
      expect(executeeQuote.hash).toBeDefined()
      expect(isHex(executeeQuote.hash)).toEqual(true)
    })

  test("should demo the devEx of preparing instructions", async () => {
    // These can be any 'Instruction', or any helper method that resolves to a 'Instruction',
    // including 'build'. They all are resolved in the 'getQuote' method under the hood.

    const currentInstructions = await meeClient.account.build({
      type: "intent",
      data: {
        amount: 50000n,
        mcToken: mcUSDC,
        toChain: targetChain
      }
    })

    const preparedInstructions = await meeClient.account.build(
      {
        type: "default",
        data: {
          instructions: [
            {
              calls: [
                {
                  to: zeroAddress,
                  gasLimit: 50000n,
                  value: 0n
                }
              ],
              chainId: targetChain.id
            }
          ]
        }
      },
      currentInstructions
    )

    expect(preparedInstructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions: preparedInstructions,
      feeToken
    })

    expect([2, 3].includes(quote.userOps.length)).toBe(true) // 2 or 3 depending on if bridging is needed
    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).toEqual(
      mcNexus.deploymentOn(paymentChain.id)?.address
    )
    expect(quote.paymentInfo.token).toEqual(feeToken.address)
    expect(+quote.paymentInfo.chainId).toEqual(paymentChain.id)
  })

  test.runIf(runPaidTests)(
    "should demo the devEx for getting a quote with preconfigured instructions, then signing and executing it",
    async () => {
      console.time("execute:hashTimer")
      // Start performance timing for tracking how long the transaction hash and receipt take
      console.time("execute:receiptTimer")

      // Get a quote for executing all instructions
      // This will calculate the total cost in the specified payment token
      const quote = await meeClient.getQuote({
        instructions: [
          mcNexus.build({
            type: "default",
            data: {
              instructions: [
                {
                  calls: [{ to: zeroAddress, gasLimit: 50000n, value: 0n }],
                  chainId: targetChain.id
                }
              ]
            }
          })
        ],
        feeToken
      })

      // Execute the quote and get back a transaction hash
      // This sends the transaction to the network
      const { hash } = await meeClient.executeQuote({ quote })
      expect(hash).toBeDefined()
      console.timeEnd("execute:hashTimer")
      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      console.timeEnd("execute:receiptTimer")
      expect(receipt).toBeDefined()
      console.log(receipt.explorerLinks)
    }
  )

  test
    .runIf(runPaidTests)
    .skip("should successfully use the aave protocol", async () => {
      const amountToSupply = parseUnits("0.00001", 6)

      const approve = mcUSDC.on(targetChain.id).approve({
        args: [
          aave.pool.addressOn(targetChain.id), // approve to aave v3 pool contract
          amountToSupply // amount approved
        ],
        gasLimit: 150_000n
      })

      const supply = aave.pool.on(targetChain.id).supply({
        args: [
          mcUSDC.addressOn(targetChain.id),
          amountToSupply,
          mcNexus.signer.address,
          0
        ],
        gasLimit: 150_000n
      })

      const quote = await meeClient.getQuote({
        instructions: [approve, supply],
        feeToken
      })

      const trigger: SignFusionQuoteParams["trigger"] = {
        chain: targetChain,
        call: {
          to: mcUSDC.addressOn(targetChain.id),
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [mcNexus.addressOn(targetChain.id, true), amountToSupply]
          })
        }
      }

      const signedFusionQuote = await meeClient.signFusionQuote({
        quote,
        trigger
      })

      const { receipt, hash } = await meeClient.executeSignedFusionQuote({
        signedFusionQuote
      })

      const sTxReceipt = await meeClient.waitForSupertransactionReceipt({
        hash
      })

      console.log(receipt.status)
      console.log(sTxReceipt.explorerLinks)
      expect(receipt).toBeDefined()
      expect(sTxReceipt).toBeDefined()
    })
})
