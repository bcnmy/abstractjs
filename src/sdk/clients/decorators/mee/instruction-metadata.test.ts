import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient,
  zeroAddress,
  encodeFunctionData,
  erc20Abi,
  stringify,
  parseUnits
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import type { Instruction } from "."
import {
  MAINNET_RPC_URLS,
  type NetworkConfig,
  toNetwork
} from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION, mcUSDC } from "../../../constants"
import { type AnyData, getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type {
  InstructionMetadata,
  InstructionMetadataType
} from "./types/instruction-metadata.type"
import { batchInstructions } from "../../../account"
import { base, optimism } from "viem/chains"

type TypeToFieldsMap = {
  [K in InstructionMetadata["type"]]: (keyof Extract<
    InstructionMetadata,
    { type: K }
  >)[]
}

const typeToRequiredFields: TypeToFieldsMap = {
  TRANSFER: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  APPROVE: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  WITHDRAW: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  BRIDGE: [
    "type",
    "fromAddress",
    "toAddress",
    "fromTokenAddress",
    "toTokenAddress",
    "fromChainId",
    "toChainId",
    "amount"
  ],
  SWAP: [
    "type",
    "fromTokenAddress",
    "toTokenAddress",
    "fromAddress",
    "toAddress",
    "chainId"
  ],
  ADD_LIQUIDITY: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  REMOVE_LIQUIDITY: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  STAKE: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  UNSTAKE: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  LEND: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  BORROW: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  CUSTOM: ["type", "description", "chainId"]
}

const expectValidInstructionMetadata = (obj: unknown) => {
  const array = Array.isArray(obj) ? obj : [obj]

  for (const item of array) {
    expect(item).to.be.an("object").and.to.have.property("type")

    const metadata = item as {
      type: InstructionMetadata["type"]
      [key: string]: AnyData
    }
    const type = metadata.type

    expect(typeToRequiredFields).to.have.property(type)

    const requiredFields = typeToRequiredFields[type]
    for (const field of requiredFields) {
      expect(metadata).to.have.property(field)
    }
  }
}

describe("Instruction metadata test", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain
  let walletClient: WalletClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
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

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  const validateMetadata = async (
    instructions: Instruction[],
    metadataTypes: InstructionMetadataType[]
  ) => {
    const batchedInstructions = await batchInstructions({
      accountAddress: mcNexus.addressOn(chain.id, true),
      instructions
    })

    const quote = await meeClient.getQuote({
      instructions: [...batchedInstructions],
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()

    const userOp = quote.userOps[1]

    const length = metadataTypes.length

    expect(userOp.metadata?.length || 0).to.be.eq(length)

    for (let i = 0; i < length; i++) {
      expect(userOp.metadata?.[i].type).to.eq(metadataTypes[i])
    }

    expect(() =>
      expectValidInstructionMetadata(userOp.metadata || [])
    ).to.not.throw()
  }

  test("Native Token Transfer instruction metadata test", async () => {
    const transfer = await mcNexus.build({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        value: 1n,
        chainId: chain.id
      }
    })

    await validateMetadata(transfer, ["TRANSFER"])
  })

  test("ERC20 Token Transfer instruction metadata test", async () => {
    const transfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(transfer, ["TRANSFER"])
  })

  test("ERC20 Token Approve instruction metadata test", async () => {
    const approve = await mcNexus.buildComposable({
      type: "approve",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id,
        spender: eoaAccount.address
      }
    })

    await validateMetadata(approve, ["APPROVE"])
  })

  test("ERC20 Token transferFrom instruction metadata test", async () => {
    const transferFrom = await mcNexus.buildComposable({
      type: "transferFrom",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 2n,
        chainId: chain.id,
        sender: eoaAccount.address,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(transferFrom, ["TRANSFER"])
  })

  test("Withdraw instruction metadata test", async () => {
    const withdraw = await mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 3n,
        chainId: chain.id,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(withdraw, ["WITHDRAW"])
  })

  test("Batched ERC20 Token approve and transferFrom instruction metadata test", async () => {
    const approve = await mcNexus.buildComposable({
      type: "approve",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id,
        spender: eoaAccount.address
      }
    })

    const transferFrom = await mcNexus.buildComposable({
      type: "transferFrom",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 2n,
        chainId: chain.id,
        sender: eoaAccount.address,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(
      [...approve, ...transferFrom],
      ["APPROVE", "TRANSFER"]
    )
  })

  test("Custom instruction metadata test", async () => {
    const customInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id
      }
    ]

    await validateMetadata(customInstruction, ["CUSTOM"])
  })

  test("Custom Stake instruction metadata test", async () => {
    const customStakeInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "STAKE",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            amount: 1n,
            chainId: chain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            protocolNames: ["Lido"]
          }
        ]
      }
    ]

    await validateMetadata(customStakeInstruction, ["STAKE"])
  })

  test("Custom Unstake instruction metadata test", async () => {
    const customUnstakeInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "UNSTAKE",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            amount: 1n,
            chainId: chain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            protocolNames: ["Stakefi"]
          }
        ]
      }
    ]

    await validateMetadata(customUnstakeInstruction, ["UNSTAKE"])
  })

  test("Custom Lend instruction metadata test", async () => {
    const customLendInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "LEND",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            amount: 1n,
            chainId: chain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            protocolNames: ["Morpho"]
          }
        ]
      }
    ]

    await validateMetadata(customLendInstruction, ["LEND"])
  })

  test("Custom Borrow instruction metadata test", async () => {
    const customBorrowInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "BORROW",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            amount: 1n,
            chainId: chain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            protocolNames: ["Aave"]
          }
        ]
      }
    ]

    await validateMetadata(customBorrowInstruction, ["BORROW"])
  })

  test("Custom Add Liquidity instruction metadata test", async () => {
    const customAddLiquidityInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "ADD_LIQUIDITY",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            amount: 1n,
            chainId: chain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            protocolNames: ["Compound"]
          }
        ]
      }
    ]

    await validateMetadata(customAddLiquidityInstruction, ["ADD_LIQUIDITY"])
  })

  test("Custom Remove Liquidity instruction metadata test", async () => {
    const customRemoveLiquidityInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "REMOVE_LIQUIDITY",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            amount: 1n,
            chainId: chain.id,
            tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            protocolNames: ["Uniswap"]
          }
        ]
      }
    ]

    await validateMetadata(customRemoveLiquidityInstruction, [
      "REMOVE_LIQUIDITY"
    ])
  })

  test("Custom Bridge instruction metadata test", async () => {
    const customBridgeInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "BRIDGE",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            fromTokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            toTokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            amount: 1n,
            toChainId: chain.id,
            fromChainId: chain.id,
            protocolNames: ["Across"]
          }
        ]
      }
    ]

    await validateMetadata(customBridgeInstruction, ["BRIDGE"])
  })

  test("Custom Swap instruction metadata test", async () => {
    const customSwapInstruction: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            value: 1n
          }
        ],
        isComposable: false,
        chainId: chain.id,
        metadata: [
          {
            type: "SWAP",
            fromAddress: eoaAccount.address,
            toAddress: eoaAccount.address,
            fromTokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            toTokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
            amount: 1n,
            chainId: chain.id,
            protocolNames: ["Uniswap"]
          }
        ]
      }
    ]

    await validateMetadata(customSwapInstruction, ["SWAP"])
  })

  test("Custom raw calldata composable instruction metadata test", async () => {
    const rawCalldata = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [mcNexus.addressOn(chain.id, true), 1n]
    })

    const rawCalldataInstruction = await mcNexus.buildComposable({
      type: "rawCalldata",
      data: {
        to: testnetMcTestUSDCP.addressOn(chain.id),
        calldata: rawCalldata,
        chainId: chain.id
      }
    })

    await validateMetadata(rawCalldataInstruction, ["CUSTOM"])
  })

  test("Custom metadata override support", async () => {
    const customMetadataOverride: InstructionMetadata[] = [
      {
        type: "TRANSFER",
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        fromAddress: eoaAccount.address,
        toAddress: eoaAccount.address,
        chainId: chain.id,
        amount: 100n
      }
    ]

    const transferFrom = await mcNexus.buildComposable({
      type: "transferFrom",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 2n,
        chainId: chain.id,
        sender: eoaAccount.address,
        recipient: eoaAccount.address,
        metadata: customMetadataOverride
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...transferFrom],
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[1].metadata?.length || 0).to.be.eq(1)

    expect(quote.userOps[1].metadata?.[0].type).to.eq("TRANSFER")

    expect(() =>
      expectValidInstructionMetadata(quote.userOps[1].metadata || [])
    ).to.not.throw()

    expect(stringify(quote.userOps[1].metadata || [])).to.eq(
      stringify(customMetadataOverride)
    )
  })

  test("Across intent wrapper bridge instruction metadata test", async () => {
    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: base,
          transport: http(MAINNET_RPC_URLS[base.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: optimism,
          transport: http(MAINNET_RPC_URLS[optimism.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })

    const benchmarkInputAmount = parseUnits("2", 6) // USDC 6 decimals

    const bridgeInstructions = await mcNexus.buildComposable({
      type: "acrossIntent",
      data: {
        depositor: mcNexus.addressOn(optimism.id, true),
        recipient: mcNexus.addressOn(base.id, true),
        inputToken: mcUSDC.addressOn(optimism.id),
        outputToken: mcUSDC.addressOn(base.id),
        inputAmountRuntimeParams: {
          targetAddress: mcNexus.addressOn(optimism.id, true),
          tokenAddress: mcUSDC.addressOn(optimism.id),
          constraints: []
        },
        approximateExpectedInputAmount: benchmarkInputAmount,
        originChainId: optimism.id,
        destinationChainId: base.id,
        message: "0x",
        relayerAddress: zeroAddress
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...bridgeInstructions],
      feeToken: {
        address: mcUSDC.addressOn(base.id),
        chainId: base.id
      }
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[1].metadata?.length || 0).to.be.eq(1)

    expect(quote.userOps[1].metadata?.[0].type).to.eq("BRIDGE")

    expect(() =>
      expectValidInstructionMetadata(quote.userOps[1].metadata || [])
    ).to.not.throw()
  })
})
