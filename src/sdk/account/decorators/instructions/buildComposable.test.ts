import {
  http,
  type Abi,
  type Address,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient,
  erc20Abi,
  fromBytes,
  parseUnits,
  toBytes,
  zeroAddress
} from "viem"
import { beforeAll, describe, expect, inject, it } from "vitest"
import { COMPOSABILITY_RUNTIME_TRANSFER_ABI } from "../../../../test/__contracts/abi/ComposabilityRuntimeTransferAbi"
import { toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { Instruction } from "../../../clients/decorators/mee/getQuote"
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
import { getMultichainContract } from "../../utils"
import buildComposable from "./buildComposable"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.buildComposable", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let publicClient: PublicClient

  let tokenAddress: Address
  let runtimeTransferAddress: Address
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

  // Skipping this just because this file takes a long time to run.
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
      }
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
})
