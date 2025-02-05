import {
  type Chain,
  type LocalAccount,
  isHex,
  parseUnits,
  zeroAddress
} from "viem"
import { gnosis } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChains, toNetwork } from "../../test/testSetup"
import type { NetworkConfig } from "../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account/toMultiChainNexusAccount"
import { aave } from "../constants/protocols"
import { mcUSDC } from "../constants/tokens"
import { type MeeClient, createMeeClient } from "./createMeeClient"
import type { FeeTokenInfo } from "./decorators/mee/getQuote"

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

    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [targetChain, paymentChain],
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test.concurrent(
    "should fail if the account is not supported by the MEE node",
    async () => {
      const invalidMcNexus = await toMultichainNexusAccount({
        chains: [targetChain, paymentChain, gnosis],
        signer: eoaAccount,
        index
      })

      expect(() =>
        createMeeClient({
          account: invalidMcNexus
        })
      ).rejects.toThrow("Please check the supported chains and try again.")
    }
  )

  test.concurrent("should get a quote", async () => {
    const meeClient = await createMeeClient({ account: mcNexus })

    const quote = await meeClient.getQuote({ instructions: [], feeToken })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).toEqual(
      mcNexus.deploymentOn(paymentChain.id)?.address
    )
    expect(quote.paymentInfo.token).toEqual(feeToken.address)
    expect(+quote.paymentInfo.chainId).toEqual(paymentChain.id)
  })

  test.concurrent("should sign a quote", async () => {
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

  test.concurrent.skip(
    "should demo the devEx of preparing instructions",
    async () => {
      // These can be any 'Instruction', or any helper method that resolves to a 'Instruction',
      // including 'build'. They all are resolved in the 'getQuote' method under the hood.
      const currentInstructions = await mcNexus.build({
        type: "intent",
        data: {
          amount: 50000n,
          mcToken: mcUSDC,
          toChain: targetChain
        }
      })

      const preparedInstructions = await mcNexus.build(
        {
          type: "default",
          data: {
            calls: [{ to: zeroAddress, value: 0n }],
            chainId: targetChain.id
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
    }
  )

  test
    .runIf(runPaidTests)
    .skip("should demo the devEx for getting a quote with preconfigured instructions, then signing and executing it", async () => {
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
              calls: [{ to: zeroAddress, value: 0n }],
              chainId: targetChain.id
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
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash
      })
      console.timeEnd("execute:receiptTimer")
      expect(receipt).toBeDefined()
      console.log(receipt.explorerLinks)
    })

  test.runIf(runPaidTests)(
    "should successfully use the aave protocol",
    async () => {
      const amountToSupply = parseUnits("0.00001", 6)

      const approval = mcNexus.build({
        type: "approve",
        data: {
          chainId: targetChain.id,
          tokenAddress: mcUSDC.addressOn(targetChain.id),
          amount: amountToSupply,
          spender: aave.pool.addressOn(targetChain.id)
        }
      })

      const supply = aave.pool.on(targetChain.id).supply({
        args: [
          mcUSDC.addressOn(targetChain.id),
          amountToSupply,
          mcNexus.signer.address,
          0
        ]
      })

      console.time("execute:fusionReceiptTimer")
      const trigger = {
        chainId: targetChain.id,
        tokenAddress: mcUSDC.addressOn(targetChain.id),
        amount: amountToSupply
      }

      const fusionQuote = await meeClient.getFusionQuote({
        instructions: [approval, supply],
        feeToken,
        trigger
      })

      const signedQuote = await meeClient.signOnChainQuote({ fusionQuote })
      const { hash } = await meeClient.executeSignedQuote({ signedQuote })
      const sTxReceipt = await meeClient.waitForSupertransactionReceipt({
        hash
      })
      console.timeEnd("execute:fusionReceiptTimer")
      console.log(sTxReceipt.explorerLinks)
      expect(sTxReceipt).toBeDefined()
    },
    {
      timeout: 2000000
    }
  )
})
