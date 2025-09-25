import {
  Implementation,
  toMetaMaskSmartAccount
} from "@metamask/delegation-toolkit"
import {
  http,
  type Account,
  type Address,
  type Chain,
  type LocalAccount,
  type OneOf,
  type PublicClient,
  type Transport,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  parseEther,
  parseUnits,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import type { FeeTokenInfo, Instruction } from "."
import {
  type NetworkConfig,
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import {
  testnetMcTestUSDC,
  testnetMcTestUSDCP
} from "../../../../test/testTokens"
import {
  getRandomAccountIndex,
  transferErc20
} from "../../../../test/testUtils"
import { buildComposable } from "../../../account/decorators"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import {
  ComposabilityVersion,
  DEFAULT_MEE_VERSION,
  MEEVersion,
  mcUSDC,
  testnetMcUSDC
} from "../../../constants"
import { getMEEVersion } from "../../../modules"
import {
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkApiKey,
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../createMeeClient"
import getMmDtkQuote from "./getMmDtkQuote"

const generateNewMcNexusAccountAndMeeClient = async (
  publicClient: PublicClient,
  walletClient: WalletClient<Transport, Chain, Account>,
  eoaAccount: LocalAccount,
  options?: {
    tokenType?: "onchain" | "permit"
    newType?: "fresh-pk" | "fresh-index"
  } & OneOf<
    | { fundEoa: boolean }
    | { fundMcNexus: boolean }
    | { fundCustomAddress: boolean; accountAddress: Address }
    | { sponsorship: boolean }
  >
) => {
  const account =
    options?.newType === "fresh-index"
      ? eoaAccount
      : privateKeyToAccount(generatePrivateKey())

  const mcNexus = await toMultichainNexusAccount({
    signer: account,
    chainConfigurations: [
      {
        chain: optimismSepolia,
        transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      },
      {
        chain: baseSepolia,
        transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
        version: getMEEVersion(DEFAULT_MEE_VERSION)
      }
    ],
    ...(options?.newType === "fresh-index"
      ? { index: BigInt(getRandomAccountIndex(1000, 1000000000)) }
      : {})
  })

  const meeClient = await createMeeClient({
    account: mcNexus,
    url: "http://localhost:4001/v1",
    apiKey: options?.sponsorship
      ? "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      : getDefaultMEENetworkApiKey(true)
  })

  let fundingAddress: Address | undefined = undefined

  if (options?.fundEoa) {
    fundingAddress = account.address
  }

  if (options?.fundMcNexus) {
    fundingAddress = mcNexus.addressOn(baseSepolia.id, true)
  }

  if (options?.fundCustomAddress && options?.accountAddress) {
    fundingAddress = options.accountAddress
  }

  if (fundingAddress) {
    await transferErc20({
      publicClient,
      walletClient,
      tokenAddress:
        options?.tokenType === "onchain"
          ? testnetMcTestUSDC.addressOn(baseSepolia.id)
          : testnetMcTestUSDCP.addressOn(baseSepolia.id),
      recipient: fundingAddress,
      amount: parseUnits("0.6", 6)
    })
  }

  return { mcNexus, meeClient, eoaAccount: account }
}

const getInstructions = async (
  mcNexus: MultichainSmartAccount
): Promise<Instruction[]> => {
  const optimismSepoliaTokenTransfer = await mcNexus.buildComposable(
    {
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
        recipient: mcNexus.signer.address,
        amount: 0n,
        chainId: optimismSepolia.id
      }
    }
  )

  const baseSepoliaTokenTransfer = await mcNexus.buildComposable(
    {
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id),
        recipient: mcNexus.signer.address,
        amount: 0n,
        chainId: baseSepolia.id
      }
    }
  )

  return [...optimismSepoliaTokenTransfer, ...baseSepoliaTokenTransfer]
}

describe("mee.getQuote({ simulations }) - Single Chain Simulation Scenarios", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain
  let walletClient: WalletClient<Transport, Chain, Account>
  let publicClient: PublicClient
  let feeToken: FeeTokenInfo

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

    feeToken = {
      address: testnetMcTestUSDCP.addressOn(chain.id),
      chainId: chain.id
    }

    meeClient = await createMeeClient({
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

    publicClient = createPublicClient({
      chain,
      transport: http(network.rpcUrl)
    })

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  test("should throw an error if there are insufficient funds to pay relayer fees", async () => {
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount
    )

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: parseUnits("100", 6),
        chainId: chain.id
      }
    })

    await expect(
      meeClient.getQuote({
        instructions: [...transferInstruction],
        feeToken
      })
    ).rejects.toThrow("Insufficient funds for relayer fees")
  })

  test("should throw an error if there are insufficient funds for the trigger amount in fusion mode", async () => {
    // generating new account to have zero balance
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount
    )

    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: parseUnits("100", 6),
        chainId: chain.id
      }
    })

    await expect(
      meeClient.getFusionQuote({
        trigger: {
          tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
          amount: 1n,
          chainId: chain.id
        },
        instructions: [...transferInstruction],
        simulation: { simulate: true },
        feeToken
      })
    ).rejects.toThrow("Insufficient funding amount for funding transaction")
  })

  test("should fail simulation if an invalid token address is provided in token overrides", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: parseUnits("100", 6),
        chainId: chain.id
      }
    })

    await expect(
      meeClient.getQuote({
        instructions: [...transferInstruction],
        simulation: {
          simulate: true,
          overrides: {
            tokenOverrides: [
              {
                tokenAddress: "0x0000000000000000000000000000000000000001",
                chainId: chain.id,
                balance: 1n,
                accountAddress: eoaAccount.address
              }
            ]
          }
        },
        feeToken
      })
    ).rejects.toThrow(
      "Failed to detect token slot. Please check your token overrides"
    )
  })

  test("should throw an error with contract address and error selector when simulation reverts with a generic execution error", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: parseUnits("100", 6),
        chainId: chain.id
      }
    })

    await expect(
      meeClient.getQuote({
        instructions: [...transferInstruction],
        simulation: {
          simulate: true,
          overrides: {
            tokenOverrides: [
              {
                tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
                chainId: chain.id,
                balance: parseUnits("10", 6),
                accountAddress: mcNexus.addressOn(chain.id, true)
              }
            ]
          }
        },
        feeToken
      })
    ).rejects.toThrowError(
      "UserOp [1] simulation failed. Revert reason: Execution reverted at contract 0x8976987ebee0806924ae17eed12229cf4789cb1f and reverted with error selector 0xe450d38c"
    )
  })

  test("should fail simulation if there are not enough ERC20 tokens to transfer in the user operation", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: parseUnits("1000000000", 6),
        chainId: chain.id
      }
    })

    await expect(
      meeClient.getQuote({
        instructions: [...transferInstruction],
        simulation: {
          simulate: true
        },
        feeToken
      })
    ).rejects.toThrowError(
      "UserOp [1] simulation failed. Revert reason: ERC20: transfer amount exceeds balance"
    )
  })

  test("should pass simulation if ERC20 balance override is provided, even if the account lacks enough tokens", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        amount: parseUnits("100000", 6),
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...transferInstruction],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: testnetMcUSDC.addressOn(chain.id),
              chainId: chain.id,
              balance: parseUnits("100000", 6), // Balance is overriden here
              accountAddress: mcNexus.addressOn(chain.id, true)
            }
          ]
        }
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should fail simulation if there are not enough native tokens to transfer in the user operation", async () => {
    const nativeTokenTransferInstruction = await mcNexus.buildComposable({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        value: parseEther("1000"),
        chainId: chain.id
      }
    })

    await expect(
      meeClient.getQuote({
        instructions: [...nativeTokenTransferInstruction],
        simulation: {
          simulate: true
        },
        feeToken
      })
    ).rejects.toThrowError(
      "UserOp [1] simulation failed. Revert reason: insufficient balance for transfer"
    )
  })

  test("should pass simulation if native token balance override is provided, even if the account lacks enough native tokens", async () => {
    const nativeTokenTransferInstruction = await mcNexus.buildComposable({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        value: parseEther("1000"),
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...nativeTokenTransferInstruction],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: zeroAddress,
              chainId: chain.id,
              balance: parseEther("1000"), // Balance is overriden here
              accountAddress: mcNexus.addressOn(chain.id, true)
            }
          ]
        }
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should pass simulation for undeployed nexus account in non-fusion mode with sufficient balance override", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        fundMcNexus: true,
        tokenType: "permit"
      }
    )

    const nativeTokenTransferInstruction = await mcNexus.buildComposable({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        value: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...nativeTokenTransferInstruction],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: zeroAddress,
              chainId: chain.id,
              balance: parseEther("1"), // Balance is overriden here
              accountAddress: mcNexus.addressOn(chain.id, true)
            }
          ]
        }
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should pass simulation for undeployed nexus account in permit mode", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        fundEoa: true,
        tokenType: "permit"
      }
    )

    const tokenTransfer = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        recipient: eoaAccount.address,
        amount: 123n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 123n
      },
      instructions: [...tokenTransfer],
      simulation: {
        simulate: true
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })

  test("should pass simulation for undeployed nexus account in onchain mode", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        fundEoa: true,
        tokenType: "onchain"
      }
    )

    const tokenTransfer = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id),
        recipient: eoaAccount.address,
        amount: 123n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id),
        chainId: chain.id,
        amount: 123n
      },
      instructions: [...tokenTransfer],
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDC.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()
  })

  test("should pass simulation for MetaMask Delegation Toolkit (MMDTK) mode with state overrides", async () => {
    const mmDtkAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Hybrid,
      deployParams: [eoaAccount.address, [], [], []],
      deploySalt: "0x",
      signatory: { account: eoaAccount }
    })

    await transferErc20({
      publicClient,
      walletClient,
      tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
      recipient: mmDtkAccount.address,
      amount: parseUnits("0.6", 6)
    })

    const tokenTransfer = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        recipient: eoaAccount.address,
        amount: 456n,
        chainId: chain.id
      }
    })

    const quote = await getMmDtkQuote(meeClient, {
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id,
        amount: 123n
      },
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
              chainId: chain.id,
              balance: 1000n, // balance override
              accountAddress: mcNexus.addressOn(chain.id, true)
            }
          ]
        }
      },
      instructions: [...tokenTransfer],
      feeToken,
      delegatorSmartAccount: mmDtkAccount
    })

    expect(quote).toBeDefined()
  })

  test("should pass simulation for undeployed nexus account with sponsorship enabled", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        sponsorship: true
      }
    )

    const tokenTransfer = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        recipient: eoaAccount.address,
        amount: 1n,
        chainId: chain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...tokenTransfer],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
              chainId: chain.id,
              balance: 1n,
              accountAddress: mcNexus.addressOn(chain.id, true)
            }
          ]
        }
      },
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      }
    })

    expect(quote).toBeDefined()
  })

  test("should pass simulation for composability version 1.1.0", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(TESTNET_RPC_URLS[chain.id]),
          version: getMEEVersion(MEEVersion.V2_2_0)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

    const tokenTransfer = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        tokenAddress: testnetMcUSDC.addressOn(chain.id),
        recipient: eoaAccount.address,
        amount: parseUnits("1000", 6),
        chainId: chain.id
      }
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      },
      instructions: [...tokenTransfer],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: testnetMcUSDC.addressOn(chain.id),
              chainId: chain.id,
              balance: parseUnits("1000", 6),
              accountAddress: mcNexus.addressOn(chain.id, true)
            }
          ]
        }
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })
})

describe("mee.getQuote({ simulations }) - Multichain Simulation Scenarios", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  let optimismToBaseAcrossCall: Instruction[]

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
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

    const benchmarkInputAmount = parseUnits("2", 6) // USDC 6 decimals

    optimismToBaseAcrossCall = await mcNexus.buildComposable({
      type: "acrossIntent",
      data: {
        depositor: mcNexus.addressOn(paymentChain.id, true),
        recipient: mcNexus.addressOn(targetChain.id, true),
        inputToken: mcUSDC.addressOn(paymentChain.id),
        outputToken: mcUSDC.addressOn(targetChain.id),
        inputAmountRuntimeParams: {
          targetAddress: mcNexus.addressOn(paymentChain.id, true),
          tokenAddress: mcUSDC.addressOn(paymentChain.id),
          constraints: []
        },
        approximateExpectedInputAmount: benchmarkInputAmount,
        originChainId: paymentChain.id,
        destinationChainId: targetChain.id,
        message: "0x",
        relayerAddress: zeroAddress
      }
    })
  })

  // Optimism chain -> Bridge -> Base chain -> Withdraw -> EOA. simulations without token overrides = Fails
  test("should fail multichain simulation if token overrides are missing for the destination chain after bridging", async () => {
    const withdrawalInstruction = await mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: mcUSDC.addressOn(targetChain.id),
        amount: parseUnits("1000", 6),
        chainId: targetChain.id
      }
    })

    await expect(
      meeClient.getQuote({
        instructions: [...optimismToBaseAcrossCall, ...withdrawalInstruction],
        simulation: {
          simulate: true
          // There is no token overrides, so during simulation the destination chain don't have funds and withdraw will fail
        },
        feeToken
      })
    ).rejects.toThrowError(
      "UserOp [2] simulation failed. Revert reason: ERC20: transfer amount exceeds balance"
    )
  })

  // Optimism chain -> Bridge -> Base chain -> Withdraw -> EOA. simulations with token overrides
  test("should pass multichain simulation if token overrides are provided for the destination chain after bridging", async () => {
    const withdrawalInstruction = await mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: mcUSDC.addressOn(targetChain.id),
        amount: parseUnits("1000", 6),
        chainId: targetChain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...optimismToBaseAcrossCall, ...withdrawalInstruction],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: mcUSDC.addressOn(targetChain.id),
              chainId: targetChain.id,
              // Token override on destination chain here
              // Withdraw instruction expects the nexus to have some funds to withdraw after bridging
              balance: parseUnits("1000", 6),
              accountAddress: mcNexus.addressOn(targetChain.id, true)
            }
          ]
        }
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })

  // Optimism chain -> Intent bridge (builder) -> Base chain -> Withdraw -> EOA
  test("should pass multichain simulation for intent bridging with correct token overrides on the destination chain", async () => {
    const optimismToBaseBridgeCall = await mcNexus.build({
      type: "intent",
      data: {
        depositor: mcNexus.addressOn(paymentChain.id, true),
        recipient: mcNexus.addressOn(targetChain.id, true),
        token: {
          mcToken: mcUSDC,
          unifiedBalance: await mcNexus.getUnifiedERC20Balance(mcUSDC)
        },
        amount: parseUnits("0.5", 6),
        toChainId: targetChain.id
      }
    })

    const withdrawalInstruction = await mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: mcUSDC.addressOn(targetChain.id),
        amount: parseUnits("0.5", 6),
        chainId: targetChain.id
      }
    })

    const quote = await meeClient.getQuote({
      instructions: [...optimismToBaseBridgeCall, ...withdrawalInstruction],
      simulation: {
        simulate: true,
        overrides: {
          tokenOverrides: [
            {
              tokenAddress: mcUSDC.addressOn(targetChain.id),
              chainId: targetChain.id,
              // Token override on destination chain here
              // Withdraw instruction expects the nexus to have some funds to withdraw after bridging
              balance: parseUnits("0.5", 6),
              accountAddress: mcNexus.addressOn(targetChain.id, true)
            }
          ]
        }
      },
      feeToken
    })

    expect(quote).toBeDefined()
  })
})

describe("mee.getQuote({ simulations }) - STX Execution with simulation-based gas estimation across account deployment and modes", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain
  let walletClient: WalletClient<Transport, Chain, Account>
  let publicClient: PublicClient
  let feeToken: FeeTokenInfo

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        },
        {
          chain: chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    feeToken = {
      address: testnetMcTestUSDCP.addressOn(chain.id),
      chainId: chain.id
    }

    meeClient = await createMeeClient({
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

    publicClient = createPublicClient({
      chain,
      transport: http(network.rpcUrl)
    })

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  test("Simulated gas estimation and execution: simple mode, account already deployed", async () => {
    const quote = await meeClient.getQuote({
      instructions: [await getInstructions(mcNexus)],
      simulation: {
        simulate: true
      },
      feeToken
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: simple mode, account undeployed", async () => {
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        fundMcNexus: true,
        tokenType: "permit"
      }
    )

    const quote = await meeClient.getQuote({
      instructions: [await getInstructions(mcNexus)],
      simulation: {
        simulate: true
      },
      feeToken
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: onchain mode, account already deployed", async () => {
    const fusionQuote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      },
      simulation: {
        simulate: true
      },
      instructions: [await getInstructions(mcNexus)],
      feeToken: {
        address: testnetMcTestUSDC.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(fusionQuote).toBeDefined()

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: onchain mode, account undeployed", async () => {
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        fundEoa: true,
        tokenType: "onchain",
        newType: "fresh-index"
      }
    )

    const fusionQuote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDC.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      },
      simulation: {
        simulate: true
      },
      instructions: [await getInstructions(mcNexus)],
      feeToken: {
        address: testnetMcTestUSDC.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(fusionQuote).toBeDefined()

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: permit mode, account already deployed", async () => {
    const fusionQuote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      },
      simulation: {
        simulate: true
      },
      instructions: [await getInstructions(mcNexus)],
      feeToken
    })

    expect(fusionQuote).toBeDefined()

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: permit mode, account undeployed", async () => {
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        fundEoa: true,
        tokenType: "permit"
      }
    )

    const fusionQuote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      },
      simulation: {
        simulate: true
      },
      instructions: [await getInstructions(mcNexus)],
      feeToken
    })

    expect(fusionQuote).toBeDefined()

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: sponsored simple mode, account undeployed", async () => {
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient(
      publicClient,
      walletClient,
      eoaAccount,
      {
        sponsorship: true,
      }
    )

    const quote = await meeClient.getQuote({
      simulation: {
        simulate: true,
      },
      instructions: [await getInstructions(mcNexus)],
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      }
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Simulated gas estimation and execution: sponsored permit mode, account already deployed", async () => {
    const fusionQuote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id
      },
      simulation: {
        simulate: true
      },
      instructions: [await getInstructions(mcNexus)],
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      }
    })

    expect(fusionQuote).toBeDefined()

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote })
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })
})
