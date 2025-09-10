import {
  http,
  type Abi,
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type Log,
  type PublicClient,
  type TransactionReceipt,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  fromBytes,
  parseEventLogs,
  parseUnits,
  toBytes,
  zeroAddress
} from "viem"
import { waitForTransactionReceipt } from "viem/actions"
import { beforeAll, describe, expect, inject, it } from "vitest"
import { COMPOSABILITY_RUNTIME_TRANSFER_ABI } from "../../../../test/__contracts/abi/ComposabilityRuntimeTransferAbi"
import { FOO_CONTRACT_ABI } from "../../../../test/__contracts/abi/FooContractAbi"
import { TEST_BLOCK_CONFIRMATIONS, toNetwork } from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import {
  type Instruction,
  userOp
} from "../../../clients/decorators/mee/getQuote"
import {
  DEFAULT_MEE_VERSION,
  UniswapSwapRouterAbi,
  testnetMcUniswapSwapRouter
} from "../../../constants"
import {
  type RuntimeValue,
  getMEEVersion,
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf
} from "../../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import { getMeeScanLink, getMultichainContract } from "../../utils"
import buildComposable from "./buildComposable"

// @ts-ignore
const { runLifecycleTests } = inject("settings")

describe.runIf(runLifecycleTests)("mee.buildComposable", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let publicClient: PublicClient

  let tokenAddress: Address
  let runtimeTransferAddress: Address
  let fooContractAddress: Address
  let chain: Chain
  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    publicClient = createPublicClient({
      chain,
      transport: http(network.rpcUrl)
    })

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: 1n, // Added based on the suggestion by Joe to prevent the collision with nonce,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })
    tokenAddress = testnetMcTestUSDCP.addressOn(chain.id)
    console.log("mcNexus", mcNexus.addressOn(chain.id, true))
    console.log("eoa.address", eoaAccount.address)

    // Mock testing contract for composability testing
    runtimeTransferAddress = "0x7c3b315E1d72CFdB8999A68a12e87fc3cc490fec"
    fooContractAddress = "0x40Ad19a280cdD7649981A7c3C76A5D725840efCF"
  })

  it.concurrent(
    "should highlight building composable instructions",
    async () => {
      const instructions: Instruction[] = await buildComposable(
        { accountAddress: mcNexus.signer.address },
        {
          to: tokenAddress,
          abi: erc20Abi,
          functionName: "transferFrom",
          args: [
            eoaAccount.address,
            mcNexus.addressOn(chain.id, true),
            runtimeERC20BalanceOf({
              targetAddress: eoaAccount.address,
              tokenAddress,
              constraints: [greaterThanOrEqualTo(parseUnits("0.01", 6))]
            })
          ],
          chainId: chain.id
        }
      )

      expect(instructions.length).toBeGreaterThan(0)
    }
  )

  // Skipping this just because this file takes a long time to run.
  it("should batch execute composable transaction with getQuotes (Without fusion)", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.08", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const fusionQuote = await meeClient.getFusionQuote({
      trigger,
      instructions: [
        {
          calls: [
            {
              to: zeroAddress,
              value: 0n
            }
          ],
          chainId: chain.id
        }
      ],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    console.log("trigger.amount", trigger.amount)
    console.log("fusionQuote.trigger.amount", fusionQuote.trigger.amount)

    const { hash: hashOne } = await meeClient.executeFusionQuote({
      fusionQuote
    })

    const { transactionStatus: transactionStatusOne } =
      await meeClient.waitForSupertransactionReceipt({
        hash: hashOne,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatusOne).to.be.eq("MINED_SUCCESS")

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFunds",
        args: [
          tokenAddress,
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress
          })
        ],
        chainId: chain.id
      }
    })

    const batchedInstructions = await mcNexus.buildComposable({
      type: "batch",
      data: {
        instructions: [...transferInstruction, ...instructions]
      }
    })

    const { hash: hashTwo } = await meeClient.executeQuote({
      quote: await meeClient.getQuote({
        instructions: batchedInstructions,
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })
    const { transactionStatus: transactionStatusTwo, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash: hashTwo,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatusTwo).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash: hashTwo })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction with getQuotes (Without fusion)", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.08", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const { hash: hashOne } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [
          {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: chain.id
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus: transactionStatusOne, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash: hashOne,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatusOne).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash: hashOne })

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFunds",
        args: [
          tokenAddress,
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress
          })
        ],
        chainId: chain.id
      }
    })

    const { hash: hashTwo } = await meeClient.executeQuote({
      quote: await meeClient.getQuote({
        instructions: [
          ...transferInstruction,
          ...instructions,
          ...instructions
        ],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const {
      transactionStatus: transactionStatusTwo,
      explorerLinks: explorerLinksTwo
    } = await meeClient.waitForSupertransactionReceipt({
      hash: hashTwo,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })
    expect(transactionStatusTwo).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks: explorerLinksTwo })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute manually batched composable transaction", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFunds",
        args: [
          tokenAddress,
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress
          })
        ],
        chainId: chain.id
      }
    })

    const fusionQuote = await meeClient.getFusionQuote({
      trigger,
      instructions: [...transferInstruction, ...instructions, ...instructions],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const receipt = await meeClient.executeFusionQuote({ fusionQuote })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash: receipt.hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash: receipt.hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute batched composable transaction", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFunds",
        args: [
          tokenAddress,
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress
          })
        ],
        chainId: chain.id
      }
    })

    const batchedInstructions = await mcNexus.buildComposable({
      type: "batch",
      data: {
        instructions: [...transferInstruction, ...instructions, ...instructions]
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: batchedInstructions,
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for static args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const balanceBefore = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [eoaAccount.address]
    })

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFunds",
        args: [
          tokenAddress,
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress
          })
        ],
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [transferInstruction, ...instructions],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    const balanceAfter = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [eoaAccount.address]
    })

    // -amountToSupply as a result of the trigger
    // +(amountToSupply-gas) as a result of the second composable action
    // so the balance should be the same -gas that nexus paid to MEE Node, as gas is paid as USDC token
    expect(Number(balanceAfter)).to.be.approximately(
      Number(balanceBefore),
      99999
    )

    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for struct args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFundsWithStruct",
        args: [
          tokenAddress,
          runtimeTransferAddress,
          {
            recipient: eoaAccount.address,
            amount: runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress,
              constraints: [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
            })
          }
        ],
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [transferInstruction, ...instructions],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for dynamic array args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFundsWithDynamicArray",
        args: [
          tokenAddress,
          runtimeTransferAddress,
          [runtimeTransferAddress, eoaAccount.address],
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress,
            constraints: [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
          })
        ],
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [transferInstruction, ...instructions],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for string args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFundsWithString",
        args: [
          tokenAddress,
          "random_string_this_doesnt_matter",
          [runtimeTransferAddress, eoaAccount.address],
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress,
            constraints: [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
          })
        ],
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [transferInstruction, ...instructions],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  it("should execute composable transaction for bytes args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for runtime arg inside dynamic array args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToSupply,
        chainId: chain.id
      }
    })

    const instructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        functionName: "transferFundsWithRuntimeParamInsideArray",
        args: [
          tokenAddress,
          [runtimeTransferAddress, eoaAccount.address],
          [
            runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress,
              constraints: [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
            })
          ]
        ],
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [transferInstruction, ...instructions],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  it("should execute composable transaction for non-runtime bytes arg", async () => {
    // Running only one test with both true and false Efficient Mode
    // to save on gas and time.
    const testCases = [true, false]
    for (const efficientMode of testCases) {
      describe(`with efficientMode: ${efficientMode}`, () => {
        it("should execute composable transaction for bytes args", async () => {
          const amountToSupply = parseUnits("0.1", 6)

          const trigger = {
            chainId: chain.id,
            tokenAddress,
            amount: amountToSupply
          }

          const transferInstruction = await mcNexus.buildComposable({
            type: "transfer",
            data: {
              recipient: runtimeTransferAddress as Address,
              tokenAddress,
              amount: amountToSupply,
              chainId: chain.id
            },
            efficientMode: efficientMode
          })

          const instructions: Instruction[] = await mcNexus.buildComposable({
            type: "default",
            data: {
              to: runtimeTransferAddress,
              abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
              functionName: "transferFundsWithBytes",
              args: [
                tokenAddress,
                fromBytes(toBytes("random_string_this_doesnt_matter"), "hex"),
                [runtimeTransferAddress, eoaAccount.address],
                runtimeERC20BalanceOf({
                  targetAddress: runtimeTransferAddress,
                  tokenAddress,
                  constraints: [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
                })
              ],
              chainId: chain.id
            },
            efficientMode: efficientMode
          })

          const { hash } = await meeClient.executeFusionQuote({
            fusionQuote: await meeClient.getFusionQuote({
              trigger,
              instructions: [transferInstruction, ...instructions],
              feeToken: {
                chainId: chain.id,
                address: tokenAddress
              }
            })
          })

          const { transactionStatus, explorerLinks } =
            await meeClient.waitForSupertransactionReceipt({
              hash,
              confirmations: TEST_BLOCK_CONFIRMATIONS
            })
          expect(transactionStatus).to.be.eq("MINED_SUCCESS")
          console.log({ explorerLinks, hash })
        })
      })
    }
  })

  // This test is skipped because there is no liquidity pool for our new mock token and fusion token
  it.skip("should execute composable transaction for uniswap args", async () => {
    const fusionToken = getMultichainContract<typeof erc20Abi>({
      abi: erc20Abi,
      deployments: [
        ["0x232fb0469e5fc7f8f5a04eddbcc11f677143f715", chain.id] // Fusion
      ]
    })

    const inToken = testnetMcTestUSDCP
    const outToken = fusionToken

    const amount = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: inToken.addressOn(chain.id),
      amount: amount
    }

    const approveInstructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: inToken.addressOn(chain.id),
        abi: erc20Abi,
        functionName: "approve",
        args: [
          testnetMcUniswapSwapRouter.addressOn(chain.id),
          runtimeERC20BalanceOf({
            targetAddress: mcNexus.addressOn(chain.id, true),
            tokenAddress: inToken.addressOn(chain.id)
          })
        ],
        chainId: chain.id
      }
    })

    const swapInstructions: Instruction[] = await mcNexus.buildComposable({
      type: "default",
      data: {
        to: testnetMcUniswapSwapRouter.addressOn(chain.id),
        abi: UniswapSwapRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: inToken.addressOn(chain.id),
            tokenOut: outToken.addressOn(chain.id),
            fee: 3000,
            recipient: eoaAccount.address,
            amountIn: runtimeERC20BalanceOf({
              targetAddress: mcNexus.addressOn(chain.id, true),
              tokenAddress: inToken.addressOn(chain.id)
            }),
            amountOutMinimum: BigInt(1),
            sqrtPriceLimitX96: BigInt(0)
          }
        ],
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [...approveInstructions, ...swapInstructions],
        feeToken: {
          chainId: chain.id,
          address: inToken.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  it("should execute composable transaction for approval and transferFrom builders", async () => {
    const amount = parseUnits("0.2", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amount
    }

    const approval = await mcNexus.build({
      type: "approve",
      data: {
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true),
          tokenAddress
        }),
        chainId: chain.id,
        tokenAddress,
        spender: mcNexus.addressOn(chain.id, true)
      }
    })

    const transfer = await mcNexus.build({
      type: "transferFrom",
      data: {
        chainId: chain.id,
        tokenAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true),
          tokenAddress
        }),
        sender: mcNexus.addressOn(chain.id, true),
        recipient: eoaAccount.address
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [...approval, ...transfer],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
  })

  it("should execute raw composable transaction for approve", async () => {
    const amount = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amount
    }

    const rawCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [runtimeTransferAddress, amount]
    })

    const approval = await mcNexus.buildComposable({
      type: "rawCalldata",
      data: {
        to: tokenAddress,
        calldata: rawCalldata,
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [...approval],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    const tokenApproval = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [mcNexus.addressOn(chain.id, true), runtimeTransferAddress]
    })

    expect(tokenApproval).to.eq(amount)
  })

  it("should cleanup Nexus USDC balance after all tests", async () => {
    const amountToSupply = parseUnits("0.05", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true),
          tokenAddress
        }),
        chainId: chain.id
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: await meeClient.getFusionQuote({
        trigger,
        instructions: [...transferInstruction],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })

    const nexusUSDCBalance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [mcNexus.addressOn(chain.id, true)]
    })

    expect(nexusUSDCBalance).to.eq(0n)
  })

  it("should execute composable cleanup for composable call", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.08", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const transferFundsInstructions: Instruction[] =
      await mcNexus.buildComposable({
        type: "default",
        data: {
          to: runtimeTransferAddress,
          abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
          functionName: "transferFunds",
          args: [
            tokenAddress,
            eoaAccount.address,
            runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress
            })
          ],
          chainId: chain.id
        }
      })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction, ...transferFundsInstructions],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    for (const userOp of userOps) {
      if (userOp.isCleanUpUserOp) {
        expect(userOp.executionStatus).to.be.oneOf([
          "MINED_FAIL",
          "PENDING",
          "MINING",
          "MINED_SUCCESS"
        ])
      } else {
        expect(userOp.executionStatus).to.be.eq("MINED_SUCCESS")
      }
    }

    console.log({ explorerLinks, hash })
  })

  it("should execute composable cleanup for composable call with custom constraints", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.08", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const transferFundsInstructions: Instruction[] =
      await mcNexus.buildComposable({
        type: "default",
        data: {
          to: runtimeTransferAddress,
          abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
          functionName: "transferFunds",
          args: [
            tokenAddress,
            eoaAccount.address,
            runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress
            })
          ],
          chainId: chain.id
        }
      })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress,
            constraints: [greaterThanOrEqualTo(5n)] // custom constraints
          })
        }
      ],
      instructions: [...transferInstruction, ...transferFundsInstructions],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    for (const userOp of userOps) {
      if (userOp.isCleanUpUserOp) {
        expect(userOp.executionStatus).to.be.oneOf([
          "MINED_FAIL",
          "PENDING",
          "MINING",
          "MINED_SUCCESS"
        ])
      } else {
        expect(userOp.executionStatus).to.be.eq("MINED_SUCCESS")
      }
    }

    console.log({ explorerLinks, hash })
  })

  it("should native token composable cleanup throw an error when amount field is not configured", async () => {
    const amountToFund = 1000n

    const trigger = {
      chainId: chain.id,
      tokenAddress: zeroAddress, // Native token representation
      amount: amountToFund
    }

    await expect(
      meeClient.getFusionQuote({
        trigger,
        cleanUps: [
          {
            tokenAddress: zeroAddress,
            chainId: chain.id,
            recipientAddress: eoaAccount.address
          }
        ],
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 500n
              }
            ],
            chainId: chain.id
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: zeroAddress // native token payment
        }
      })
    ).rejects.toThrowError(
      "Please configure the amount for the native token cleanup."
    )
  })

  it("should native token composable cleanup throw an error when amount field is runtime value", async () => {
    const amountToFund = 1000n

    const trigger = {
      chainId: chain.id,
      tokenAddress: zeroAddress, // Native token representation
      amount: amountToFund
    }

    const mockRuntimeValue = {} as RuntimeValue

    await expect(
      meeClient.getFusionQuote({
        trigger,
        cleanUps: [
          {
            tokenAddress: zeroAddress,
            chainId: chain.id,
            recipientAddress: eoaAccount.address,
            amount: mockRuntimeValue
          }
        ],
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 500n
              }
            ],
            chainId: chain.id
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: zeroAddress // native token payment
        }
      })
    ).rejects.toThrowError(
      "Runtime amount for the native token cleanup is not supported yet."
    )
  })

  it("should composable cleanup throw an error when there is no instruction", async () => {
    const amountToFund = 1000n

    const trigger = {
      chainId: chain.id,
      tokenAddress: zeroAddress, // Native token representation
      amount: amountToFund
    }

    await expect(
      meeClient.getFusionQuote({
        trigger,
        cleanUps: [
          {
            tokenAddress: zeroAddress,
            chainId: chain.id,
            recipientAddress: eoaAccount.address,
            amount: 1n
          }
        ],
        instructions: [],
        feeToken: {
          chainId: chain.id,
          address: zeroAddress // native token payment
        }
      })
    ).rejects.toThrowError(
      "Atleast one instruction should be configured to use cleanups."
    )
  })

  it("should execute native token composable cleanup for composable call", async () => {
    const amountToFund = 1000n

    const trigger = {
      chainId: chain.id,
      tokenAddress: zeroAddress, // Native token representation
      amount: amountToFund
    }

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress: zeroAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: 500n
        }
      ],
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 500n
            }
          ],
          chainId: chain.id
        }
      ],
      feeToken: {
        chainId: chain.id,
        address: zeroAddress // native token payment
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    for (const userOp of userOps) {
      if (userOp.isCleanUpUserOp) {
        expect(userOp.executionStatus).to.be.oneOf([
          "MINED_FAIL",
          "PENDING",
          "MINING",
          "MINED_SUCCESS"
        ])
      } else {
        expect(userOp.executionStatus).to.be.eq("MINED_SUCCESS")
      }
    }

    console.log({ explorerLinks, hash })
  })

  it("should execute composable cleanup for non composable call", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.08", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    for (const userOp of userOps) {
      if (userOp.isCleanUpUserOp) {
        expect(userOp.executionStatus).to.be.oneOf([
          "MINED_FAIL",
          "PENDING",
          "MINING",
          "MINED_SUCCESS"
        ])
      } else {
        expect(userOp.executionStatus).to.be.eq("MINED_SUCCESS")
      }
    }

    console.log({ explorerLinks, hash })
  })

  it("should composable cleanup fail for no dust/funds", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    // actual dev defined userops
    expect(userOps[0].executionStatus).to.be.eq("MINED_SUCCESS")

    // cleanup userops - SDK doesn't wait for cleanup userOp status
    expect(userOps[1].executionStatus).to.be.oneOf([
      "MINED_FAIL",
      "PENDING",
      "MINING",
      "MINED_SUCCESS"
    ])

    console.log({ explorerLinks, hash })
  })

  it("should composable cleanup execute when main userops fails", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("1000000", 6)

    const tx = await mcNexus
      .deploymentOn(chain.id)
      ?.walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [mcNexus.addressOn(chain.id, true), amountToSupply],
        chain
      })

    await waitForTransactionReceipt(publicClient, {
      hash: tx as Hex,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    const transferInstruction = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeQuote({
      quote: quote
    })

    console.log(getMeeScanLink(hash))

    try {
      const { transactionStatus, explorerLinks, userOps } =
        await meeClient.waitForSupertransactionReceipt({
          hash,
          confirmations: TEST_BLOCK_CONFIRMATIONS
        })

      expect(transactionStatus).to.be.eq("MINED_SUCCESS")

      // actual dev defined userops
      expect(userOps[0].executionStatus).to.be.eq("MINED_FAIL")

      // cleanup userops - SDK doesn't wait for cleanup userOp status
      expect(userOps[1].executionStatus).to.be.oneOf([
        "MINED_FAIL",
        "PENDING",
        "MINING",
        "MINED_SUCCESS"
      ])

      console.log({ explorerLinks, hash })
    } catch (error) {
      // UserOp one always reverts
      expect(error.message).to.be.oneOf([
        "[0] UserOperation reverted",
        "[0] ERC20: transfer amount exceeds balance"
      ])
    }
  })

  it("should multiple composable cleanup execute", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.06", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress,
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: parseUnits("0.01", 6)
        },
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: parseUnits("0.01", 6)
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    for (const userOp of userOps) {
      if (userOp.isCleanUpUserOp) {
        expect(userOp.executionStatus).to.be.oneOf([
          "MINED_FAIL",
          "PENDING",
          "MINING",
          "MINED_SUCCESS"
        ])
      } else {
        expect(userOp.executionStatus).to.be.eq("MINED_SUCCESS")
      }
    }

    console.log({ explorerLinks, hash })
  })

  it("should composable cleanup execute based on dependency config", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.01", 6)

    const tx = await mcNexus
      .deploymentOn(chain.id)
      ?.walletClient.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [mcNexus.addressOn(chain.id, true), amountToSupply],
        chain
      })

    await waitForTransactionReceipt(publicClient, {
      hash: tx as Hex,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    const transferInstructionOne = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const transferInstructionTwo = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress,
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...transferInstructionOne, ...transferInstructionTwo],
      cleanUps: [
        {
          tokenAddress,
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: amountToTransfer,
          dependsOn: [userOp(1), userOp(2)]
        }
      ],
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })

    const { hash } = await meeClient.executeQuote({
      quote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    for (const userOp of userOps) {
      if (userOp.isCleanUpUserOp) {
        expect(userOp.executionStatus).to.be.oneOf([
          "MINED_FAIL",
          "PENDING",
          "MINING",
          "MINED_SUCCESS"
        ])
      } else {
        expect(userOp.executionStatus).to.be.eq("MINED_SUCCESS")
      }
    }

    console.log({ explorerLinks, hash })
  })

  it("should composable cleanup fails for wrong userOp dependencies", async () => {
    try {
      const amountToSupply = parseUnits("0.1", 6)

      const transferInstruction = await mcNexus.buildComposable({
        type: "transfer",
        data: {
          recipient: eoaAccount.address,
          tokenAddress,
          amount: amountToSupply,
          chainId: chain.id
        }
      })

      await meeClient.getQuote({
        instructions: [...transferInstruction],
        cleanUps: [
          {
            tokenAddress,
            chainId: chain.id,
            recipientAddress: eoaAccount.address,
            dependsOn: [userOp(1), userOp(2)]
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    } catch (e) {
      expect(e.message).to.eq(
        "Invalid UserOp dependency, please check the dependsOn configuration"
      )
    }
  })

  it("should composable cleanup fails for userOp dependencies less than or equal to 0", async () => {
    try {
      const amountToSupply = parseUnits("0.1", 6)

      const transferInstruction = await mcNexus.buildComposable({
        type: "transfer",
        data: {
          recipient: eoaAccount.address,
          tokenAddress,
          amount: amountToSupply,
          chainId: chain.id
        }
      })

      await meeClient.getQuote({
        instructions: [...transferInstruction],
        cleanUps: [
          {
            tokenAddress,
            chainId: chain.id,
            recipientAddress: eoaAccount.address,
            dependsOn: [userOp(0), userOp(1)]
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: tokenAddress
        }
      })
    } catch (e) {
      expect(e.message).to.eq("UserOp index should be greater than zero")
    }
  })
})

// ================================ assert emit event helpers =====================
function _assertEmitAddressEvent(
  receipts: TransactionReceipt[],
  index: number,
  expectedAddress: string
) {
  const logs: Log[] = []
  for (const receipt of receipts) {
    const transferLogs = parseEventLogs({
      abi: FOO_CONTRACT_ABI as Abi,
      eventName: "EmitAddress",
      logs: receipt.logs
    })

    logs.push(...transferLogs)
  }

  const eventAbi = {
    name: "EmitAddress",
    type: "event",
    inputs: [{ name: "a", type: "address", indexed: false }]
  } as const

  type MyEventLog = Log<bigint, number, boolean, typeof eventAbi>

  const myEventLog = logs[index] as MyEventLog

  expect(myEventLog.args.a).to.eq(expectedAddress)
}

function _assertEmitBytes32Event(
  receipts: TransactionReceipt[],
  index: number,
  expectedBytes32: Hex
) {
  const logs: Log[] = []
  for (const receipt of receipts) {
    const transferLogs = parseEventLogs({
      abi: FOO_CONTRACT_ABI as Abi,
      eventName: "EmitBytes32",
      logs: receipt.logs
    })

    logs.push(...transferLogs)
  }

  const eventAbi = {
    name: "EmitBytes32",
    type: "event",
    inputs: [{ name: "b", type: "bytes32", indexed: false }]
  } as const

  type MyEventLog = Log<bigint, number, boolean, typeof eventAbi>

  const myEventLog = logs[index] as MyEventLog

  expect(myEventLog.args.b).to.eq(expectedBytes32)
}

function _assertEmitUint256Event(
  receipts: TransactionReceipt[],
  index: number,
  expectedUint256: bigint
) {
  const logs: Log[] = []
  for (const receipt of receipts) {
    const transferLogs = parseEventLogs({
      abi: FOO_CONTRACT_ABI as Abi,
      eventName: "EmitUint256",
      logs: receipt.logs
    })

    logs.push(...transferLogs)
  }

  const eventAbi = {
    name: "EmitUint256",
    type: "event",
    inputs: [{ name: "u", type: "uint256", indexed: false }]
  } as const

  type MyEventLog = Log<bigint, number, boolean, typeof eventAbi>

  const myEventLog = logs[index] as MyEventLog

  expect(myEventLog.args.u).to.eq(expectedUint256)
}

function _assertEmitBytesEvent(
  receipts: TransactionReceipt[],
  index: number,
  expectedBytes: Hex
) {
  const logs: Log[] = []
  for (const receipt of receipts) {
    const transferLogs = parseEventLogs({
      abi: FOO_CONTRACT_ABI as Abi,
      eventName: "EmitBytes",
      logs: receipt.logs
    })

    logs.push(...transferLogs)
  }

  const eventAbi = {
    name: "EmitBytes",
    type: "event",
    inputs: [{ name: "b", type: "bytes", indexed: false }]
  } as const

  type MyEventLog = Log<bigint, number, boolean, typeof eventAbi>

  const myEventLog = logs[index] as MyEventLog

  expect(myEventLog.args.b).to.eq(expectedBytes)
}
