import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient,
  parseUnits
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, test } from "vitest"
import {
  type NetworkConfig,
  TESTNET_RPC_URLS,
  toNetwork
} from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION } from "../../../constants"
import { getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"

describe("mee.getQuote({ simulations })", () => {
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
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  test("Should fail early when there is no enough funds for relayer fees", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(TESTNET_RPC_URLS[chain.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ],
      index: 100n // random index here
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

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
      url: "http://localhost:4001/v1"
    })

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

  test("Simulation should fail when there is no sufficient token balance override for token transfer", async () => {
    const transferInstruction = await mcNexus.buildComposable({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: parseUnits("100", 6),
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

    expect(quote).toBeDefined()
  })
})
