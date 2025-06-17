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
import { toNetwork } from "../../../../test/testSetup"
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
  UniswapSwapRouterAbi,
  testnetMcUniswapSwapRouter
} from "../../../constants"
import { testnetMcUSDC } from "../../../constants/tokens"
import { greaterThanOrEqualTo, runtimeERC20BalanceOf } from "../../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import { getMeeScanLink, getMultichainContract } from "../../utils"
import buildComposable from "./buildComposable"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe.runIf(runPaidTests)("mee.buildComposable", () => {
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
      transport: http()
    })

    mcNexus = await toMultichainNexusAccount({
      chains: [chain],
      transports: [http()],
      signer: eoaAccount,
      index: 1n // Added based on the suggestion by Joe to prevent the collision with nonce
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })
    tokenAddress = testnetMcUSDC.addressOn(chain.id)

    console.log("mcNexus", mcNexus.addressOn(chain.id, true))
    console.log("eoa.address", eoaAccount.address)

    // Mock testing contract for composability testing
    runtimeTransferAddress = "0xb46e85b8Bd24D1dca043811D5b8B18b2a8c5F95D"
    fooContractAddress = "0x40Ad19a280cdD7649981A7c3C76A5D725840efCF"
  })

  it.concurrent(
    "should highlight building composable instructions",
    async () => {
      const instructions: Instruction[] = await buildComposable(
        { account: mcNexus },
        {
          to: tokenAddress,
          abi: erc20Abi,
          functionName: "transferFrom",
          args: [
            eoaAccount.address,
            mcNexus.addressOn(chain.id, true),
            runtimeERC20BalanceOf({
              targetAddress: eoaAccount.address,
              tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    console.log("trigger.amount", trigger.amount)
    console.log("fusionQuote.trigger.amount", fusionQuote.trigger.amount)

    const { hash: hashOne } = await meeClient.executeFusionQuote({
      fusionQuote
    })

    const { transactionStatus: transactionStatusOne } =
      await meeClient.waitForSupertransactionReceipt({ hash: hashOne })
    expect(transactionStatusOne).to.be.eq("MINED_SUCCESS")

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus: transactionStatusTwo, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash: hashTwo })
    expect(transactionStatusTwo).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash: hashTwo })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction with getQuotes (Without fusion)", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.08", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus: transactionStatusOne, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash: hashOne })
    expect(transactionStatusOne).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash: hashOne })

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const {
      transactionStatus: transactionStatusTwo,
      explorerLinks: explorerLinksTwo
    } = await meeClient.waitForSupertransactionReceipt({ hash: hashTwo })
    expect(transactionStatusTwo).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks: explorerLinksTwo })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute manually batched composable transaction", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const receipt = await meeClient.executeFusionQuote({ fusionQuote })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({
        hash: receipt.hash
      })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash: receipt.hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute batched composable transaction", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for static args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const balanceBefore = await publicClient.readContract({
      address: testnetMcUSDC.addressOn(chain.id),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [eoaAccount.address]
    })

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          eoaAccount.address,
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    const balanceAfter = await publicClient.readContract({
      address: testnetMcUSDC.addressOn(chain.id),
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
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          runtimeTransferAddress,
          {
            recipient: eoaAccount.address,
            amount: runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for dynamic array args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          runtimeTransferAddress,
          [runtimeTransferAddress, eoaAccount.address],
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for string args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          "random_string_this_doesnt_matter",
          [runtimeTransferAddress, eoaAccount.address],
          runtimeERC20BalanceOf({
            targetAddress: runtimeTransferAddress,
            tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  it("should execute composable transaction for bytes args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for runtime arg inside dynamic array args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          [runtimeTransferAddress, eoaAccount.address],
          [
            runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
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
            tokenAddress: testnetMcUSDC.addressOn(chain.id),
            amount: amountToSupply
          }

          const transferInstruction = await mcNexus.buildComposable({
            type: "transfer",
            data: {
              recipient: runtimeTransferAddress as Address,
              tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
                fromBytes(toBytes("random_string_this_doesnt_matter"), "hex"),
                [runtimeTransferAddress, eoaAccount.address],
                runtimeERC20BalanceOf({
                  targetAddress: runtimeTransferAddress,
                  tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
                address: testnetMcUSDC.addressOn(chain.id)
              }
            })
          })

          const { transactionStatus, explorerLinks } =
            await meeClient.waitForSupertransactionReceipt({ hash })
          expect(transactionStatus).to.be.eq("MINED_SUCCESS")
          console.log({ explorerLinks, hash })
        })
      })
    }
  })

  // Skipping this just because this file takes a long time to run.
  it("should execute composable transaction for uniswap args", async () => {
    const fusionToken = getMultichainContract<typeof erc20Abi>({
      abi: erc20Abi,
      deployments: [
        ["0x232fb0469e5fc7f8f5a04eddbcc11f677143f715", chain.id] // Fusion
      ]
    })

    const inToken = testnetMcUSDC
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
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })
  })

  it("should execute composable transaction for approval and transferFrom builders", async () => {
    const amount = parseUnits("0.2", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amount
    }

    const approval = await mcNexus.build({
      type: "approve",
      data: {
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true),
          tokenAddress: testnetMcUSDC.addressOn(chain.id)
        }),
        chainId: chain.id,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        spender: mcNexus.addressOn(chain.id, true)
      }
    })

    const transfer = await mcNexus.build({
      type: "transferFrom",
      data: {
        chainId: chain.id,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true),
          tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
  })

  it("should execute raw composable transaction for approve", async () => {
    const amount = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
        to: testnetMcUSDC.addressOn(chain.id),
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    const tokenApproval = await publicClient.readContract({
      address: testnetMcUSDC.addressOn(chain.id),
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
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: runtimeERC20BalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true),
          tokenAddress: testnetMcUSDC.addressOn(chain.id)
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
          address: testnetMcUSDC.addressOn(chain.id)
        }
      })
    })

    const { transactionStatus, explorerLinks } =
      await meeClient.waitForSupertransactionReceipt({ hash })
    expect(transactionStatus).to.be.eq("MINED_SUCCESS")
    console.log({ explorerLinks, hash })

    const nexusUSDCBalance = await publicClient.readContract({
      address: testnetMcUSDC.addressOn(chain.id),
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
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: runtimeTransferAddress as Address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
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
            eoaAccount.address,
            runtimeERC20BalanceOf({
              targetAddress: runtimeTransferAddress,
              tokenAddress: testnetMcUSDC.addressOn(chain.id)
            })
          ],
          chainId: chain.id
        }
      })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction, ...transferFundsInstructions],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({ hash })

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
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({ hash })

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
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({ hash })

    expect(transactionStatus).to.be.eq("MINED_SUCCESS")

    // payment userops
    expect(userOps[0].executionStatus).to.be.eq("MINED_SUCCESS")

    // actual dev defined userops
    expect(userOps[1].executionStatus).to.be.eq("MINED_SUCCESS")

    // cleanup userops - SDK doesn't wait for cleanup userOp status
    expect(userOps[2].executionStatus).to.be.oneOf([
      "MINED_FAIL",
      "PENDING",
      "MINING",
      "MINED_SUCCESS"
    ])

    console.log({ explorerLinks, hash })
  })

  it("should composable cleanup execute when main userops fails", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("1", 6)

    const tx = await mcNexus
      .deploymentOn(chain.id)
      ?.walletClient.writeContract({
        address: testnetMcUSDC.addressOn(chain.id),
        abi: erc20Abi,
        functionName: "transfer",
        args: [mcNexus.addressOn(chain.id, true), amountToSupply],
        chain
      })

    await waitForTransactionReceipt(publicClient, {
      hash: tx as Hex,
      confirmations: 2
    })

    const transferInstruction = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      cleanUps: [
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const { hash } = await meeClient.executeQuote({
      quote: quote
    })

    console.log(getMeeScanLink(hash))

    try {
      const { transactionStatus, explorerLinks, userOps } =
        await meeClient.waitForSupertransactionReceipt({ hash })

      expect(transactionStatus).to.be.eq("MINED_SUCCESS")

      // payment userops
      expect(userOps[0].executionStatus).to.be.eq("MINED_SUCCESS")

      // actual dev defined userops
      expect(userOps[1].executionStatus).to.be.eq("MINED_FAIL")

      // cleanup userops - SDK doesn't wait for cleanup userOp status
      expect(userOps[2].executionStatus).to.be.oneOf([
        "MINED_FAIL",
        "PENDING",
        "MINING",
        "MINED_SUCCESS"
      ])

      console.log({ explorerLinks, hash })
    } catch (error) {
      // UserOp one always reverts
      expect(error.message).to.be.oneOf([
        "[1] UserOperation reverted",
        "[1] ERC20: transfer amount exceeds balance"
      ])
    }
  })

  it("should multiple composable cleanup execute", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.06", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger,
      cleanUps: [
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: parseUnits("0.01", 6)
        },
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: parseUnits("0.01", 6)
        }
      ],
      instructions: [...transferInstruction],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const { hash } = await meeClient.executeFusionQuote({
      fusionQuote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({ hash })

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

  // Skipping this test. It is working well when running alone. Has some conflicts while running globally.
  // This is safe to skip
  it.skip("should composable cleanup execute based on dependency config", async () => {
    const amountToSupply = parseUnits("0.1", 6)
    const amountToTransfer = parseUnits("0.01", 6)

    const tx = await mcNexus
      .deploymentOn(chain.id)
      ?.walletClient.writeContract({
        address: testnetMcUSDC.addressOn(chain.id),
        abi: erc20Abi,
        functionName: "transfer",
        args: [mcNexus.addressOn(chain.id, true), amountToSupply],
        chain
      })

    await waitForTransactionReceipt(publicClient, {
      hash: tx as Hex,
      confirmations: 2
    })

    const transferInstructionOne = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const transferInstructionTwo = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: amountToTransfer,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...transferInstructionOne, ...transferInstructionTwo],
      cleanUps: [
        {
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          chainId: chain.id,
          recipientAddress: eoaAccount.address,
          amount: amountToTransfer,
          dependsOn: [userOp(1), userOp(2)]
        }
      ],
      feeToken: {
        chainId: chain.id,
        address: testnetMcUSDC.addressOn(chain.id)
      }
    })

    const { hash } = await meeClient.executeQuote({
      quote: quote
    })

    const { transactionStatus, explorerLinks, userOps } =
      await meeClient.waitForSupertransactionReceipt({ hash })

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
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          amount: amountToSupply,
          chainId: chain.id
        }
      })

      await meeClient.getQuote({
        instructions: [...transferInstruction],
        cleanUps: [
          {
            tokenAddress: testnetMcUSDC.addressOn(chain.id),
            chainId: chain.id,
            recipientAddress: eoaAccount.address,
            dependsOn: [userOp(1), userOp(2)]
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: testnetMcUSDC.addressOn(chain.id)
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
          tokenAddress: testnetMcUSDC.addressOn(chain.id),
          amount: amountToSupply,
          chainId: chain.id
        }
      })

      await meeClient.getQuote({
        instructions: [...transferInstruction],
        cleanUps: [
          {
            tokenAddress: testnetMcUSDC.addressOn(chain.id),
            chainId: chain.id,
            recipientAddress: eoaAccount.address,
            dependsOn: [userOp(0), userOp(1)]
          }
        ],
        feeToken: {
          chainId: chain.id,
          address: testnetMcUSDC.addressOn(chain.id)
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
