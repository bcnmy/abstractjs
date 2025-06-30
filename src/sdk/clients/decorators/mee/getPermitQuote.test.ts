import {
  http,
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  createPublicClient,
  parseUnits,
  zeroAddress
} from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  DEFAULT_GAS_LIMIT,
  type FeeTokenInfo,
  type Instruction,
  type Trigger,
  executeSignedQuote,
  getFusionQuote,
  signPermitQuote,
  waitForSupertransactionReceipt
} from "."
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC, testnetMcUSDC } from "../../../constants/tokens"
import {
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf
} from "../../../modules/utils/composabilityCalls"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import getPermitQuote from "./getPermitQuote"

describe("mee.getPermitQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  test("should resolve instructions", async () => {
    const trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n
    }
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      },
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      }
    ]

    expect(instructions).toBeDefined()
    expect(instructions.length).toEqual(2)

    const quote = await getPermitQuote(meeClient, {
      trigger,
      instructions,
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const fusionQuote = await getPermitQuote(meeClient, {
      trigger: {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
          type: "intent",
          data: {
            amount: 1n,
            mcToken: mcUSDC,
            toChain: targetChain
          }
        }),
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    expect(fusionQuote.quote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect([3, 4].includes(fusionQuote.quote.userOps.length)).toBe(true) // 3 or 4 depending on if bridging is needed
  })

  test("should trigger have a default gas limit as 75K gas", async () => {
    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n
    }

    const transfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress,
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [transfer],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect(fusionQuote.trigger.gasLimit).toBe(DEFAULT_GAS_LIMIT)

    expect(fusionQuote.quote.paymentInfo.callGasLimit).toBe(
      DEFAULT_GAS_LIMIT.toString()
    )

    const gasLimit = transfer[0].calls.reduce((acc, call) => {
      const gas = call?.gasLimit || LARGE_DEFAULT_GAS_LIMIT
      return gas + acc
    }, 0n)

    expect(fusionQuote.quote.userOps[1]).toBeDefined()
    expect(fusionQuote.quote.userOps[1].userOp.callGasLimit).to.eq(
      (DEFAULT_GAS_LIMIT + gasLimit).toString()
    )
  })

  test("should trigger have a custom gas limit", async () => {
    const customGasLimit = 100_000n

    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount: 1n,
      gasLimit: customGasLimit
    }

    const transfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress,
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [transfer],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()
    expect(fusionQuote.trigger.gasLimit).toBe(customGasLimit)

    expect(fusionQuote.quote.paymentInfo.callGasLimit).toBe(
      customGasLimit.toString()
    )

    const gasLimit = transfer[0].calls.reduce((acc, call) => {
      const gas = call?.gasLimit || LARGE_DEFAULT_GAS_LIMIT
      return gas + acc
    }, 0n)

    expect(fusionQuote.quote.userOps[1]).toBeDefined()
    expect(fusionQuote.quote.userOps[1].userOp.callGasLimit).to.eq(
      (customGasLimit + gasLimit).toString()
    )
  })

  test("should reserve gas fees when using max available amount", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [baseSepolia],
      transports: [http(TESTNET_RPC_URLS[baseSepolia.id])],
      signer: eoaAccount
    })

    const meeClient = await createMeeClient({ account: mcNexus })

    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    })

    const trigger: Trigger = {
      chainId: baseSepolia.id,
      tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
      useMaxAvailableFunds: true
    }

    // withdraw
    const withdrawal = mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(baseSepolia.id, true),
          tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id)
        }),
        chainId: baseSepolia.id
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [withdrawal],
      feeToken: {
        address: testnetMcUSDC.addressOn(baseSepolia.id),
        chainId: baseSepolia.id
      }
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // EOA balance maximum available balance fetch
    const maxAvailableBalance = await getBalance(
      client,
      eoaAccount.address,
      trigger.tokenAddress
    )

    // The final amount should be the total balance
    expect(fusionQuote.trigger.amount).toBe(maxAvailableBalance)
  })

  // This test uses available usdc on the eoa on mainnet, so should be skipped
  test.skip("should demo behaviour of max available amount", async () => {
    const client = createPublicClient({
      chain: paymentChain,
      transport: paymentChainTransport
    })

    const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const chainId = paymentChain.id
    const mcNexusAddress = mcNexus.addressOn(paymentChain.id, true)

    const trigger: Trigger = {
      chainId,
      tokenAddress,
      useMaxAvailableFunds: true
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId,
        tokenAddress,
        recipient: vitalik,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexusAddress,
          tokenAddress,
          constraints: [greaterThanOrEqualTo(1n)]
        })
      }
    })

    const fusionQuote = await meeClient.getPermitQuote({
      trigger,
      instructions: [transferInstruction], // inx 1 => transferFrom (Runtime) + Dev userOps
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // EOA balance maximum available balance fetch
    const maxAvailableBalance = await getBalance(
      client,
      mcNexus.signer.address,
      trigger.tokenAddress
    )

    // The final amount should be the total balance
    expect(fusionQuote.trigger.amount).toBe(maxAvailableBalance)

    const signedQuote = await signPermitQuote(meeClient, { fusionQuote }) // Permit with 20k
    const { hash } = await executeSignedQuote(meeClient, { signedQuote })

    const receipt = await waitForSupertransactionReceipt(meeClient, {
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  // This test uses all available usdc on the eoa on mainnet, so should be skipped
  test.skip("should demo behaviour of max available amount", async () => {
    const vitalik = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    const chainId = paymentChain.id
    const mcNexusAddress = mcNexus.addressOn(paymentChain.id, true)
    const trigger: Trigger = {
      chainId,
      tokenAddress,
      useMaxAvailableFunds: true
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        chainId,
        tokenAddress,
        recipient: vitalik,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexusAddress,
          tokenAddress,
          constraints: [greaterThanOrEqualTo(1n)]
        })
      }
    })

    const fusionQuote = await meeClient.getPermitQuote({
      trigger,
      instructions: [transferInstruction], // inx 1 => transferFrom (Runtime) + Dev userOps
      feeToken
    })

    const signedQuote = await signPermitQuote(meeClient, { fusionQuote }) // Permit with 20k
    const { hash } = await executeSignedQuote(meeClient, { signedQuote })

    const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("should add gas fees to amount when not using max available amount", async () => {
    const amount = parseUnits("1", 6) // 1 unit of token
    const trigger: Trigger = {
      chainId: paymentChain.id,
      tokenAddress,
      amount
      // max not set, should default to false
    }

    // withdraw
    const withdrawal = mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(paymentChain.id, true),
          tokenAddress
        }),
        chainId: paymentChain.id
      }
    })

    const fusionQuote = await getFusionQuote(meeClient, {
      trigger,
      instructions: [withdrawal],
      feeToken
    })

    expect(fusionQuote).toBeDefined()
    expect(fusionQuote.trigger).toBeDefined()

    // The final amount should be the initial amount plus gas fees
    expect(fusionQuote.trigger.amount).toBe(
      amount + BigInt(fusionQuote.quote.paymentInfo.tokenWeiAmount)
    )
  })
})
