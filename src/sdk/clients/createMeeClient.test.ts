import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  isHex,
  parseUnits,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { gnosisChiado } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../account/toMultiChainNexusAccount"
import { aave, mcAaveV3Pool } from "../constants/protocols"
import { mcAUSDC, mcUSDC } from "../constants/tokens"
import { type MeeClient, createMeeClient } from "./createMeeClient"
import type { FeeTokenInfo } from "./decorators/mee/getQuote"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.createMeeClient", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let recipientAccount: LocalAccount
  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]
  let tokenAddress: Address
  const index = 0n

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!

    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount,
      transports,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    recipientAccount = privateKeyToAccount(generatePrivateKey())
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test.concurrent(
    "should fail if the account is not supported by the MEE node",
    async () => {
      const transports = [http(), http(), http()]
      const invalidMcNexus = await toMultichainNexusAccount({
        chains: [paymentChain, targetChain, gnosisChiado],
        transports,
        signer: eoaAccount,
        index
      })

      await expect(
        createMeeClient({
          account: invalidMcNexus
        })
      ).rejects.toThrow("Please check the supported chains and try again.")
    }
  )

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

  test.concurrent("should demo preparing instructions", async () => {
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
  })

  test.runIf(runPaidTests)(
    "should get a quote, then execute it with executeQuote correctly",
    async () => {
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
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash
      })
      expect(receipt).toBeDefined()
    }
  )

  test.runIf(runPaidTests)(
    "should execute a quote using signOnChainQuote",
    async () => {
      const trigger = {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      }

      const fusionQuote = await meeClient.getOnChainQuote({
        trigger,
        instructions: [
          mcNexus.build({
            type: "transfer",
            data: {
              ...trigger,
              recipient: recipientAccount.address
            }
          })
        ],
        feeToken
      })

      const signedQuote = await meeClient.signOnChainQuote({ fusionQuote })
      const executeSignedQuoteResponse = await meeClient.executeSignedQuote({
        signedQuote
      })
      const superTransactionReceipt =
        await meeClient.waitForSupertransactionReceipt({
          hash: executeSignedQuoteResponse.hash,
          confirmations: 3
        })
      expect(superTransactionReceipt.explorerLinks.length).toBeGreaterThan(0)
      expect(isHex(executeSignedQuoteResponse.hash)).toBe(true)

      const balanceOfRecipient = await getBalance(
        mcNexus.deploymentOn(paymentChain.id, true).publicClient,
        recipientAccount.address,
        tokenAddress
      )

      expect(balanceOfRecipient).toBe(trigger.amount)
    }
  )

  test.runIf(runPaidTests)(
    "should successfully use the aave protocol using a fusion quote",
    async () => {
      const amountToSupply = parseUnits("0.1", 6)

      const balanceBefore = await getBalance(
        mcNexus.deploymentOn(targetChain.id, true).publicClient,
        mcNexus.signer.address,
        mcAUSDC.addressOn(targetChain.id)
      )

      console.log("")

      const trigger = {
        chainId: paymentChain.id,
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: amountToSupply
      }

      console.time("aave:getFusionQuote")
      console.time("aave:executeFusionQuote")
      console.time("aave:waitForSupertransactionReceipt")

      const fusionQuote = await meeClient.getFusionQuote({
        instructions: [
          mcNexus.build({
            type: "intent",
            data: {
              amount: amountToSupply,
              mcToken: mcUSDC,
              toChain: targetChain
            }
          }),
          mcNexus.build({
            type: "approve",
            data: {
              chainId: targetChain.id,
              tokenAddress: mcUSDC.addressOn(targetChain.id),
              amount: amountToSupply,
              spender: aave.pool.addressOn(targetChain.id)
            }
          }),
          mcAaveV3Pool.build({
            type: "supply",
            data: {
              chainId: targetChain.id,
              args: [
                mcUSDC.addressOn(targetChain.id),
                amountToSupply,
                mcNexus.signer.address,
                0
              ]
            }
          })
        ],
        feeToken,
        trigger
      })

      console.timeEnd("aave:getFusionQuote")
      const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
      console.timeEnd("aave:executeFusionQuote")
      const sTxReceipt = await meeClient.waitForSupertransactionReceipt({
        hash
      })
      console.timeEnd("aave:waitForSupertransactionReceipt")
      const balanceAfter = await getBalance(
        mcNexus.deploymentOn(targetChain.id, true).publicClient,
        mcNexus.signer.address,
        mcAUSDC.addressOn(targetChain.id)
      )
      expect(balanceAfter).toBeGreaterThan(balanceBefore)
      expect(sTxReceipt).toBeDefined()
    }
  )
})
