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
import { beforeAll, describe, expect, test } from "vitest"
import {
  type NetworkConfig,
  TESTNET_RPC_URLS,
  toNetwork
} from "../../../../test/testSetup"
import {
  testnetMcTestUSDC,
  testnetMcTestUSDCP
} from "../../../../test/testTokens"
import { transferErc20 } from "../../../../test/testUtils"
import { getMeeScanLink } from "../../../account"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION, testnetMcUSDC } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import {
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkApiKey,
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../createMeeClient"
import getMmDtkQuote from "./getMmDtkQuote"

describe("mee.getQuote({ simulations })", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain
  let walletClient: WalletClient<Transport, Chain, Account>
  let publicClient: PublicClient

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

  const generateNewMcNexusAccountAndMeeClient = async (
    options?: { tokenType?: "onchain" | "permit" } & OneOf<
      | { fundEoa: boolean }
      | { fundMcNexus: boolean }
      | { fundCustomAddress: boolean; accountAddress: Address }
      | { sponsorship: boolean }
    >
  ) => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(TESTNET_RPC_URLS[chain.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
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
      fundingAddress = eoaAccount.address
    }

    if (options?.fundMcNexus) {
      fundingAddress = mcNexus.addressOn(chain.id, true)
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
            ? testnetMcTestUSDC.addressOn(chain.id)
            : testnetMcTestUSDCP.addressOn(chain.id),
        recipient: fundingAddress,
        amount: parseUnits("0.6", 6)
      })
    }

    return { mcNexus, meeClient, eoaAccount }
  }

  test("Should fail early when there is no enough funds for relayer fees", async () => {
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient()

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
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(chain.id),
          chainId: chain.id
        }
      })
    ).rejects.toThrow("Insufficient funds for relayer fees")
  })

  test("Should fail early when there is no enough funds for trigger amount", async () => {
    // generating new account to have zero balance
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient()

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
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(chain.id),
          chainId: chain.id
        }
      })
    ).rejects.toThrow("Insufficient funding amount for funding transaction")
  })

  test("Simulation should fail when wrong token address is being used for simulations", async () => {
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
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(chain.id),
          chainId: chain.id
        }
      })
    ).rejects.toThrow(
      "Failed to detect token slot. Please check your token overrides"
    )
  })

  test("Simulations should throw an error with contract address and error selector when the revert error is just execution reverted", async () => {
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
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(chain.id),
          chainId: chain.id
        }
      })
    ).rejects.toThrowError(
      "UserOp [1] simulation failed. Revert reason: Execution reverted at contract 0x8976987ebee0806924ae17eed12229cf4789cb1f and reverted with error selector 0xe450d38c"
    )
  })

  test("Simulations should fail when there is not enough ERC20 tokens to transfer in developer defined userOp", async () => {
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
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(chain.id),
          chainId: chain.id
        }
      })
    ).rejects.toThrowError(
      "UserOp [1] simulation failed. Revert reason: ERC20: transfer amount exceeds balance"
    )
  })

  test("Simulations should pass when there is not enough ERC20 tokens to transfer in developer defined userOp but ERC20 balance override is available", async () => {
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
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()
  })

  test("Simulations should fail when there is not enough Native tokens to transfer in developer defined userOp", async () => {
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
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(chain.id),
          chainId: chain.id
        }
      })
    ).rejects.toThrowError(
      "UserOp [1] simulation failed. Revert reason: insufficient balance for transfer"
    )
  })

  test("Simulations should pass when there is not enough Native tokens to transfer in developer defined userOp but native balance override is available", async () => {
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
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()
  })

  test("Simulations should pass for undeployed nexus account with non fusion mode", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient({
      fundMcNexus: true,
      tokenType: "permit"
    })

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
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()
  })

  test("Simulations should pass for undeployed nexus account with permit mode", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient({
      fundEoa: true,
      tokenType: "permit"
    })

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
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()
  })

  test("Simulations should pass for undeployed nexus account with onchain mode", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient({
      fundEoa: true,
      tokenType: "onchain"
    })

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

  test("Simulations with state overrides should pass for mmdtk mode", async () => {
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
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(chain.id),
        chainId: chain.id
      },
      delegatorSmartAccount: mmDtkAccount
    })

    expect(quote).toBeDefined()
  })

  test("Simulations should pass for undeployed nexus account with sponsorship", async () => {
    // New fresh undeployed account
    const { mcNexus, meeClient } = await generateNewMcNexusAccountAndMeeClient({
      sponsorship: true
    })

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
})
