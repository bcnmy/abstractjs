import {
  http,
  type Abi,
  type Address,
  type Chain,
  type LocalAccount,
  erc20Abi,
  fromBytes,
  parseUnits,
  toBytes
} from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
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
import { getMeeScanLink } from "../../utils/explorer"
import buildComposable from "./buildComposable"

describe("mee.buildComposable", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address
  let runtimeTransferAddress: Address
  let chain: Chain

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!

    chain = baseSepolia

    mcNexus = await toMultichainNexusAccount({
      chains: [chain],
      transports: [http()],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = testnetMcUSDC.addressOn(chain.id)

    // Mock testing contract for composability testing
    runtimeTransferAddress = "0xb46e85b8Bd24D1dca043811D5b8B18b2a8c5F95D"
  })

  it("should highlight building composable instructions", async () => {
    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: tokenAddress,
        abi: erc20Abi,
        params: {
          type: "transferFrom",
          data: {
            args: [
              eoaAccount.address,
              mcNexus.addressOn(chain.id, true),
              runtimeERC20BalanceOf(
                eoaAccount.address,
                testnetMcUSDC,
                chain.id,
                [greaterThanOrEqualTo(parseUnits("0.01", 6))]
              )
            ]
          }
        },
        chainId: chain.id
      }
    )

    expect(instructions.length).toBeGreaterThan(0)
  })

  it("should execute composable transaction for static args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = testnetMcUSDC.on(chain.id).transfer({
      args: [runtimeTransferAddress, amountToSupply]
    })

    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        params: {
          type: "transferFunds",
          data: {
            args: [
              eoaAccount.address,
              runtimeERC20BalanceOf(
                runtimeTransferAddress,
                testnetMcUSDC,
                chain.id,
                [greaterThanOrEqualTo(parseUnits("0.01", 6))]
              )
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for static args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })

  it("should execute composable transaction for struct args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = testnetMcUSDC.on(chain.id).transfer({
      args: [runtimeTransferAddress, amountToSupply]
    })

    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        params: {
          type: "transferFundsWithStruct",
          data: {
            args: [
              runtimeTransferAddress,
              {
                recipient: eoaAccount.address,
                amount: runtimeERC20BalanceOf(
                  runtimeTransferAddress,
                  testnetMcUSDC,
                  chain.id,
                  [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
                )
              }
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for struct args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })

  it("should execute composable transaction for dynamic array args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = testnetMcUSDC.on(chain.id).transfer({
      args: [runtimeTransferAddress, amountToSupply]
    })

    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        params: {
          type: "transferFundsWithDynamicArray",
          data: {
            args: [
              runtimeTransferAddress,
              [runtimeTransferAddress, eoaAccount.address],
              runtimeERC20BalanceOf(
                runtimeTransferAddress,
                testnetMcUSDC,
                chain.id,
                [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
              )
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for dynamic array args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })

  it("should execute composable transaction for string args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = testnetMcUSDC.on(chain.id).transfer({
      args: [runtimeTransferAddress, amountToSupply]
    })

    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        params: {
          type: "transferFundsWithString",
          data: {
            args: [
              "random_string_this_doesnt_matter",
              [runtimeTransferAddress, eoaAccount.address],
              runtimeERC20BalanceOf(
                runtimeTransferAddress,
                testnetMcUSDC,
                chain.id,
                [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
              )
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for string args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })

  it("should execute composable transaction for bytes args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = testnetMcUSDC.on(chain.id).transfer({
      args: [runtimeTransferAddress, amountToSupply]
    })

    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        params: {
          type: "transferFundsWithBytes",
          data: {
            args: [
              fromBytes(toBytes("random_string_this_doesnt_matter"), "hex"),
              [runtimeTransferAddress, eoaAccount.address],
              runtimeERC20BalanceOf(
                runtimeTransferAddress,
                testnetMcUSDC,
                chain.id,
                [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
              )
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for bytes args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })

  it("should execute composable transaction for runtime arg inside dynamic array args", async () => {
    const amountToSupply = parseUnits("0.1", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: testnetMcUSDC.addressOn(chain.id),
      amount: amountToSupply
    }

    const transferInstruction = testnetMcUSDC.on(chain.id).transfer({
      args: [runtimeTransferAddress, amountToSupply]
    })

    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: runtimeTransferAddress,
        abi: COMPOSABILITY_RUNTIME_TRANSFER_ABI as Abi,
        params: {
          type: "transferFundsWithRuntimeParamInsideArray",
          data: {
            args: [
              [runtimeTransferAddress, eoaAccount.address],
              [
                runtimeERC20BalanceOf(
                  runtimeTransferAddress,
                  testnetMcUSDC,
                  chain.id,
                  [greaterThanOrEqualTo(parseUnits("0.01", 6))] // 6 decimals for USDC
                )
              ]
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for runtime arg inside dynamic array args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })

  it("should execute composable transaction for uniswap args", async () => {
    const fusionToken = getMultichainContract<typeof erc20Abi>({
      abi: erc20Abi,
      deployments: [
        ["0x232fb0469e5fc7f8f5a04eddbcc11f677143f715", chain.id] // Fusion
      ]
    })

    const inToken = testnetMcUSDC
    const outToken = fusionToken

    const amount = parseUnits("0.2", 6)

    const trigger = {
      chainId: chain.id,
      tokenAddress: inToken.addressOn(chain.id),
      amount: amount
    }

    const approveInstructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: inToken.addressOn(chain.id),
        abi: erc20Abi as Abi,
        params: {
          type: "approve",
          data: {
            args: [
              testnetMcUniswapSwapRouter.addressOn(chain.id),
              runtimeERC20BalanceOf(
                mcNexus.addressOn(chain.id, true),
                inToken,
                chain.id
              )
            ]
          }
        },
        chainId: chain.id
      }
    )

    const swapInstructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: testnetMcUniswapSwapRouter.addressOn(chain.id),
        abi: UniswapSwapRouterAbi as Abi,
        params: {
          type: "exactInputSingle",
          data: {
            args: [
              {
                tokenIn: inToken.addressOn(chain.id),
                tokenOut: outToken.addressOn(chain.id),
                fee: 3000,
                recipient: eoaAccount.address,
                amountIn: runtimeERC20BalanceOf(
                  mcNexus.addressOn(chain.id, true),
                  inToken,
                  chain.id
                ),
                amountOutMinimum: BigInt(1),
                sqrtPriceLimitX96: BigInt(0)
              }
            ]
          }
        },
        chainId: chain.id
      }
    )

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

    console.log(
      "Link for composable transaction for uniswap args: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
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
        amount: runtimeERC20BalanceOf(
          mcNexus.addressOn(chain.id, true),
          testnetMcUSDC,
          chain.id
        ),
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
        amount: runtimeERC20BalanceOf(
          mcNexus.addressOn(chain.id, true),
          testnetMcUSDC,
          chain.id
        ),
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

    console.log(
      "Link for composable transaction for approval and transferFrom builders: ",
      getMeeScanLink(hash)
    )

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })

    const execResult = receipt.receipts.map(
      (receipt) => receipt.status === "fulfilled"
    )

    // This is not 100% reliable to assume the SuperTX is successful. Because the MEE explorer shows success status for failed user
    // operation as well. This will be 100% reliable when the MEE node changes the status handling
    expect(new Array(receipt.receipts.length).fill(true).toString()).to.be.eq(
      execResult.toString()
    )
  })
})
