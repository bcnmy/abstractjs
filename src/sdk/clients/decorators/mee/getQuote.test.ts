import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  createWalletClient,
  erc20Abi,
  publicActions
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import {
  type NetworkConfig,
  getBalance,
  getRandomAccountIndex,
  setAllowance,
  transferErc20
} from "../../../../test/testUtils"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../../modules"
import {
  DEFAULT_MEE_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../createMeeClient"
import {
  CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION,
  DEFAULT_GAS_LIMIT,
  type FeeTokenInfo,
  type Instruction,
  getQuote
} from "./getQuote"

// @ts-ignore
const { runPaidTests } = inject("settings")

describe("mee.getQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
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

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should resolve instructions", async () => {
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

    const quote = await getQuote(meeClient, { instructions, feeToken })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const quote = await getQuote(meeClient, {
      instructions: [
        mcNexus.build({
          type: "intent",
          data: {
            depositor: mcNexus.addressOn(paymentChain.id, true),
            recipient: mcNexus.addressOn(targetChain.id, true),
            amount: 1n,
            token: {
              mcToken: mcUSDC,
              unifiedBalance: await mcNexus.getUnifiedERC20Balance(mcUSDC)
            },
            toChainId: targetChain.id
          }
        }),
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: "0x0000000000000000000000000000000000000000",
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

    expect([2, 3].includes(quote.userOps.length)).toBe(true) // 2 or 3 depending on if bridging is needed
  })

  test("should payment info have a default gas limit", async () => {
    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      feeToken
    })

    expect(quote).toBeDefined()

    expect(quote.paymentInfo.callGasLimit).toBe(DEFAULT_GAS_LIMIT.toString())
  })

  test("should payment info have a custom gas limit", async () => {
    const customGasLimit = 100_000n

    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      gasLimit: customGasLimit,
      feeToken
    })

    expect(quote).toBeDefined()

    expect(quote.paymentInfo.callGasLimit).toBe(customGasLimit.toString())
  })

  test("Cleanup userOp should have extra time window", async () => {
    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      cleanUps: [
        {
          tokenAddress: mcUSDC.addressOn(paymentChain.id),
          chainId: paymentChain.id,
          recipientAddress: eoaAccount.address
        }
      ],
      feeToken
    })

    expect(quote).toBeDefined()

    // userOp 1 => user defined
    // userOp 2 => cleanup which has 50% additional execution window from default execution window
    expect(
      quote.userOps[1].upperBoundTimestamp +
        CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION
    ).to.eq(quote.userOps[2].upperBoundTimestamp)

    // If no custom gasLimit for userOp ? Default large gas limit will be used
    expect(quote.userOps[2].userOp.callGasLimit).to.eq(
      LARGE_DEFAULT_GAS_LIMIT.toString()
    )
  })

  test("Cleanup userOp should have custom gas limit", async () => {
    const customGasLimit = 100_000n

    const transfer = mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: mcUSDC.addressOn(paymentChain.id),
        amount: 1n,
        chainId: paymentChain.id,
        recipient: eoaAccount.address
      }
    })

    const quote = await getQuote(meeClient, {
      instructions: [transfer],
      cleanUps: [
        {
          tokenAddress: mcUSDC.addressOn(paymentChain.id),
          chainId: paymentChain.id,
          recipientAddress: eoaAccount.address,
          gasLimit: customGasLimit
        }
      ],
      feeToken
    })

    expect(quote).toBeDefined()

    // userOp 2 => cleanup userOp
    expect(quote.userOps[2].userOp.callGasLimit).to.eq(
      customGasLimit.toString()
    )
  })
  test("Should get quote for sponsored super transaction (Testnet)", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: baseSepolia.id
        }
      ]
    })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).to.eq(
      DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.paymentInfo.chainId).to.eq(
      String(DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID)
    )
    expect(quote.paymentInfo.token.toLowerCase()).to.eq(
      DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS.toLowerCase()
    )

    expect(quote.userOps[0].userOp.sender).to.eq(
      DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].userOp.signature).toBeDefined()

    for (const meeUserOp of quote.userOps.slice(1)) {
      expect(meeUserOp.userOp.sender).to.eq(mcNexus.addressOn(baseSepolia.id))
      expect(meeUserOp.userOp.signature).not.toBeDefined()
    }
  })

  test("Should get quote for sponsored super transaction (Mainnet)", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: paymentChain.id
        }
      ]
    })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.paymentInfo.chainId).to.eq(
      String(DEFAULT_MEE_SPONSORSHIP_CHAIN_ID)
    )
    expect(quote.paymentInfo.token.toLowerCase()).to.eq(
      DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS.toLowerCase()
    )

    expect(quote.userOps[0].userOp.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].userOp.signature).toBeDefined()

    for (const meeUserOp of quote.userOps.slice(1)) {
      expect(meeUserOp.userOp.sender).to.eq(mcNexus.addressOn(paymentChain.id))
      expect(meeUserOp.userOp.signature).not.toBeDefined()
    }
  })

  test("Should get quote for sponsored super transaction with init code on first developer defined userOp", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: BigInt(getRandomAccountIndex(1000, 10000000000000)),
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: paymentChain.id
        }
      ]
    })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.paymentInfo.chainId).to.eq(
      String(DEFAULT_MEE_SPONSORSHIP_CHAIN_ID)
    )
    expect(quote.paymentInfo.token.toLowerCase()).to.eq(
      DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS.toLowerCase()
    )

    expect(quote.userOps[0].userOp.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].userOp.signature).toBeDefined()

    expect(quote.userOps[1].userOp.initCode).not.eq("0x")
    expect(quote.userOps[1].userOp.sender).to.eq(
      mcNexus.addressOn(paymentChain.id)
    )
    expect(quote.userOps[1].userOp.signature).not.toBeDefined()

    for (const meeUserOp of quote.userOps.slice(2)) {
      expect(meeUserOp.userOp.initCode).to.eq("0x")
      expect(meeUserOp.userOp.sender).to.eq(mcNexus.addressOn(paymentChain.id))
      expect(meeUserOp.userOp.signature).not.toBeDefined()
    }
  })

  test("Should get quote for sponsored super transaction with authorization list on first developer defined userOp", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: BigInt(getRandomAccountIndex(1000, 10000000000000)),
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      delegate: true,
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: paymentChain.id
        }
      ]
    })

    expect(quote).toBeDefined()
    expect(quote.paymentInfo.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.paymentInfo.chainId).to.eq(
      String(DEFAULT_MEE_SPONSORSHIP_CHAIN_ID)
    )
    expect(quote.paymentInfo.token.toLowerCase()).to.eq(
      DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS.toLowerCase()
    )

    expect(quote.userOps[0].userOp.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].userOp.signature).toBeDefined()

    expect(quote.userOps[1].userOp.initCode).to.eq("0x")

    expect(quote.userOps[1].eip7702Auth).toBeDefined()

    expect(quote.userOps[1].eip7702Auth?.address).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.chainId).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.nonce).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.r).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.s).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.yParity).toBeDefined()

    expect(quote.userOps[1].userOp.sender).to.eq(
      mcNexus.addressOn(paymentChain.id)
    )
    expect(quote.userOps[1].userOp.signature).not.toBeDefined()

    for (const meeUserOp of quote.userOps.slice(2)) {
      expect(meeUserOp.userOp.initCode).to.eq("0x")
      expect(quote.userOps[1].eip7702Auth).not.toBeDefined()
      expect(meeUserOp.userOp.sender).to.eq(mcNexus.addressOn(paymentChain.id))
      expect(meeUserOp.userOp.signature).not.toBeDefined()
    }
  })

  test("Should get quote for sponsored fusion super transaction with init code on first developer defined userOp", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: BigInt(getRandomAccountIndex(1000, 10000000000000)),
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const amountToTrigger = 1n

    const fusionQuote = await meeClient.getFusionQuote({
      sponsorship: true,
      trigger: {
        amount: amountToTrigger,
        chainId: paymentChain.id,
        tokenAddress: mcUSDC.addressOn(paymentChain.id)
      },
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: paymentChain.id
        }
      ]
    })
    expect(fusionQuote).toBeDefined()

    // This ensure no fees are covered in trigger amount
    expect(fusionQuote.trigger.amount).to.eq(amountToTrigger)

    expect(fusionQuote.quote.paymentInfo.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(fusionQuote.quote.paymentInfo.chainId).to.eq(
      String(DEFAULT_MEE_SPONSORSHIP_CHAIN_ID)
    )
    expect(fusionQuote.quote.paymentInfo.token.toLowerCase()).to.eq(
      DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS.toLowerCase()
    )

    expect(fusionQuote.quote.userOps[0].userOp.sender).to.eq(
      DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    )
    expect(fusionQuote.quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(fusionQuote.quote.userOps[0].userOp.signature).toBeDefined()

    expect(fusionQuote.quote.userOps[1].userOp.initCode).not.eq("0x")
    expect(fusionQuote.quote.userOps[1].userOp.sender).to.eq(
      mcNexus.addressOn(paymentChain.id)
    )
    expect(fusionQuote.quote.userOps[1].userOp.signature).not.toBeDefined()

    for (const meeUserOp of fusionQuote.quote.userOps.slice(2)) {
      expect(meeUserOp.userOp.initCode).to.eq("0x")
      expect(meeUserOp.userOp.sender).to.eq(mcNexus.addressOn(paymentChain.id))
      expect(meeUserOp.userOp.signature).not.toBeDefined()
    }
  })

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored super transaction (Testnet)",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        signer: eoaAccount,
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true)
        },
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 0n
              }
            ],
            chainId: baseSepolia.id
          }
        ]
      })

      expect(quote).toBeDefined()

      const { hash } = await meeClient.executeQuote({ quote })

      expect(hash).toBeDefined()
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }
  )

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored super transaction (Mainnet)",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        signer: eoaAccount,
        chainConfigurations: [
          {
            chain: paymentChain,
            transport: paymentChainTransport,
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 0n
              }
            ],
            chainId: paymentChain.id
          }
        ]
      })

      expect(quote).toBeDefined()

      const { hash } = await meeClient.executeQuote({ quote })

      expect(hash).toBeDefined()
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }
  )

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored super transaction for undeployed SCA case",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        signer: eoaAccount,
        index: BigInt(getRandomAccountIndex(1000, 1000000000)),
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })

      const nexusAccount = mcNexus.deploymentOn(baseSepolia.id, true)

      await expect(await nexusAccount.isDeployed()).to.eq(false)

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true)
        },
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 0n
              }
            ],
            chainId: baseSepolia.id
          }
        ]
      })

      expect(quote).toBeDefined()

      const { hash } = await meeClient.executeQuote({ quote })

      expect(hash).toBeDefined()
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })
      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      await expect(await nexusAccount.isDeployed()).to.eq(true)
    }
  )

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored super transaction with 7702 delegation",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        signer: eoaAccount,
        index: BigInt(getRandomAccountIndex(1000, 1000000000)),
        accountAddress: eoaAccount.address,
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })

      const nexusAccount = mcNexus.deploymentOn(baseSepolia.id, true)
      const publicClient = nexusAccount.walletClient.extend(publicActions)

      let isDelegated = await nexusAccount.isDelegated()

      if (isDelegated) {
        const txHash = await nexusAccount.unDelegate()
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: TEST_BLOCK_CONFIRMATIONS
        })
        isDelegated = await nexusAccount.isDelegated()
      }

      await expect(isDelegated).to.eq(false)

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true)
        },
        delegate: true,
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 1n
              }
            ],
            chainId: baseSepolia.id
          }
        ]
      })

      expect(quote).toBeDefined()

      const { hash } = await meeClient.executeQuote({ quote })

      expect(hash).toBeDefined()
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      isDelegated = await nexusAccount.isDelegated()

      await expect(isDelegated).to.eq(true)

      if (isDelegated) {
        const txHash = await nexusAccount.unDelegate()
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: TEST_BLOCK_CONFIRMATIONS
        })

        await expect(await nexusAccount.isDelegated()).to.eq(false)
      }
    }
  )

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored fusion super transaction",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        signer: eoaAccount,
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })

      const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

      const amountToTransfer = 1n

      const balanceBefore = await getBalance(
        publicClient,
        mcNexus.addressOn(baseSepolia.id, true),
        testnetMcTestUSDCP.addressOn(baseSepolia.id)
      )

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      })

      const quote = await meeClient.getFusionQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true)
        },
        trigger: {
          amount: amountToTransfer,
          chainId: baseSepolia.id,
          tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
        },
        instructions: [
          {
            calls: [
              {
                to: eoaAccount.address,
                value: 1n
              }
            ],
            chainId: baseSepolia.id
          }
        ]
      })

      expect(quote).toBeDefined()

      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote: quote
      })

      expect(hash).toBeDefined()
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      const balanceAfter = await getBalance(
        publicClient,
        mcNexus.addressOn(baseSepolia.id, true),
        testnetMcTestUSDCP.addressOn(baseSepolia.id)
      )

      expect(balanceAfter).to.eq(balanceBefore + amountToTransfer)
    }
  )

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored fusion super transaction for undeployed SCA case",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        signer: eoaAccount,
        index: BigInt(getRandomAccountIndex(1000, 1000000000)),
        chainConfigurations: [
          {
            chain: baseSepolia,
            transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
            version: getMEEVersion(DEFAULT_MEE_VERSION)
          }
        ]
      })

      const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

      const amountToTransfer = 1n

      const balanceBefore = await getBalance(
        publicClient,
        eoaAccount.address,
        testnetMcTestUSDCP.addressOn(baseSepolia.id)
      )

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      })

      const transferInx = await mcNexus.build({
        type: "transfer",
        data: {
          tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id),
          amount: amountToTransfer,
          chainId: baseSepolia.id,
          recipient: eoaAccount.address
        }
      })

      const quote = await meeClient.getFusionQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true)
        },
        trigger: {
          amount: amountToTransfer,
          chainId: baseSepolia.id,
          tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
        },
        instructions: [transferInx]
      })

      expect(quote).toBeDefined()

      const { hash } = await meeClient.executeFusionQuote({
        fusionQuote: quote
      })

      expect(hash).toBeDefined()
      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      const balanceAfter = await getBalance(
        publicClient,
        eoaAccount.address,
        testnetMcTestUSDCP.addressOn(baseSepolia.id)
      )

      expect(balanceAfter).to.eq(balanceBefore)
    }
  )

  // This test will be always skipped. This test requires someone to run a sponsored backend service from starter kit repo
  test.skip("Should execute sponsored supertransaction with self hosted sponsorship backend (Testnet)", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: "http://localhost:3004/v1",
        customHeaders: {
          hello: "world"
        },
        gasTank: {
          address: "0xC2461985dE59CcA97eBAcBBF1eDBe904ea859c84",
          token: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
          chainId: 84532
        }
      },
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: baseSepolia.id
        }
      ]
    })

    const { hash } = await meeClient.executeQuote({ quote: quote })

    const { transactionStatus } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.to.eq("MINED_SUCCESS")
  })

  // This test will be always skipped. This test requires someone to run a sponsored backend service from starter kit repo
  test.skip("Should execute fusion sponsored supertransaction with self hosted sponsorship backend (Testnet)", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id),
        chainId: baseSepolia.id,
        amount: 1n
      },
      sponsorship: true,
      sponsorshipOptions: {
        url: "http://localhost:3004/v1",
        customHeaders: {
          hello: "world"
        },
        gasTank: {
          address: "0xC2461985dE59CcA97eBAcBBF1eDBe904ea859c84",
          token: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
          chainId: 84532
        }
      },
      instructions: [
        {
          calls: [
            {
              to: eoaAccount.address,
              value: 1n
            }
          ],
          chainId: baseSepolia.id
        }
      ]
    })

    const { hash } = await meeClient.executeFusionQuote({ fusionQuote: quote })

    const { transactionStatus } =
      await meeClient.waitForSupertransactionReceipt({
        hash,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

    expect(transactionStatus).to.to.eq("MINED_SUCCESS")
  })

  // Skipping this test due to the possibilities of transaction failures due to gas estimations
  // It transfer Native tokens and ERC20 tokens as a initial process for test and it sometimes fails
  // due to gas fluctuations
  test.skip("should use feePayer if provided", async () => {
    const chain = baseSepolia

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
      account: mcNexus
    })

    const tokenAddress = testnetMcTestUSDCP.addressOn(chain.id)
    const feeAccount = privateKeyToAccount(generatePrivateKey())

    const walletClient = createWalletClient({
      account: feeAccount,
      chain,
      transport: http(TESTNET_RPC_URLS[chain.id])
    })

    const signerWalletClient = createWalletClient({
      account: mcNexus.signer,
      chain,
      transport: http(TESTNET_RPC_URLS[chain.id])
    })

    const { publicClient } = mcNexus.deploymentOn(chain.id, true)

    const quote = await meeClient.getQuote({
      instructions: [
        mcNexus.build({
          type: "transferFrom",
          data: {
            // dummy transfer as a transaction
            amount: 1n,
            sender: feeAccount.address,
            tokenAddress,
            chainId: chain.id,
            recipient: eoaAccount.address
          }
        })
      ],
      feePayer: feeAccount.address,
      feeToken: {
        chainId: chain.id,
        address: tokenAddress
      }
    })
    const request = await publicClient.simulateContract({
      account: feeAccount.address,
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [
        mcNexus.addressOn(chain.id, true),
        BigInt(quote.paymentInfo.tokenWeiAmount) + 1n
      ]
    })
    // Estimate gas for approve
    // @ts-ignore
    const approveGas = await publicClient.estimateGas(request)

    // Estimate current gas fees
    const gasFees = await publicClient.estimateFeesPerGas()

    // Add 25% buffer
    const totalGasWithBuffer = (approveGas * gasFees.maxFeePerGas * 125n) / 100n

    // Transfer ETH to the fee account
    const sendEthHash = await signerWalletClient.sendTransaction({
      to: feeAccount.address,
      value: totalGasWithBuffer
    })

    await publicClient.waitForTransactionReceipt({
      hash: sendEthHash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    // transfer usdc to the fee account
    await transferErc20({
      publicClient,
      walletClient: signerWalletClient,
      tokenAddress,
      recipient: feeAccount.address,
      amount: BigInt(quote.paymentInfo.tokenWeiAmount) + 1n
    })

    // set allowance to the fee account on the mcNexus account
    await setAllowance({
      publicClient,
      walletClient,
      tokenAddress,
      spender: mcNexus.addressOn(chain.id, true),
      amount: BigInt(quote.paymentInfo.tokenWeiAmount) + 1n
    })

    const { hash } = await meeClient.executeQuote({ quote })
    // Wait for the transaction to complete
    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    const feeAccountErc20Balance = await getBalance(
      publicClient,
      feeAccount.address,
      tokenAddress
    )
    expect(feeAccountErc20Balance).toBe(0n)
  })

  test("Should SDK automatically inject 7702 auth for multiple chains", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const optimismSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: optimismSepolia,
      transport: http(TESTNET_RPC_URLS[optimismSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version: baseSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      baseSepolia.id,
      true
    )
    const { version: optimismSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      optimismSepolia.id,
      true
    )

    // Auth is only being signed manually here for comparision purposes
    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: baseSepoliaMcNexusVersion.implementationAddress
    })

    // Auth is only being signed manually here for comparision purposes
    const optimismSepoliaAuth =
      await optimismSepoliaWalletClient.signAuthorization({
        contractAddress: optimismSepoliaMcNexusVersion.implementationAddress
      })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      authorizations: [], // No auth is added. So the SDK should add auth message in all userOps with multichain context
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].eip7702Auth).not.toBeDefined()

    expect(quote.userOps[1].userOp.initCode).to.eq("0x")
    expect(quote.userOps[1].eip7702Auth).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.address).to.eq(
      baseSepoliaMcNexusVersion.implementationAddress
    )
    expect(quote.userOps[1].eip7702Auth?.chainId).to.eq(baseSepolia.id)
    expect(quote.userOps[1].eip7702Auth?.nonce).to.eq(baseSepoliaAuth.nonce)
    expect(quote.userOps[1].eip7702Auth?.r).to.eq(baseSepoliaAuth.r)
    expect(quote.userOps[1].eip7702Auth?.s).to.eq(baseSepoliaAuth.s)
    expect(quote.userOps[1].eip7702Auth?.yParity).to.eq(baseSepoliaAuth.yParity)

    expect(quote.userOps[2].userOp.initCode).to.eq("0x")
    expect(quote.userOps[2].eip7702Auth).toBeDefined()
    expect(quote.userOps[2].eip7702Auth?.address).to.eq(
      optimismSepoliaMcNexusVersion.implementationAddress
    )
    expect(quote.userOps[2].eip7702Auth?.chainId).to.eq(optimismSepolia.id)
    expect(quote.userOps[2].eip7702Auth?.nonce).to.eq(optimismSepoliaAuth.nonce)
    expect(quote.userOps[2].eip7702Auth?.r).to.eq(optimismSepoliaAuth.r)
    expect(quote.userOps[2].eip7702Auth?.s).to.eq(optimismSepoliaAuth.s)
    expect(quote.userOps[2].eip7702Auth?.yParity).to.eq(
      optimismSepoliaAuth.yParity
    )
  })

  test("Should SDK inject manually signed 7702 auth for multiple chains", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const optimismSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: optimismSepolia,
      transport: http(TESTNET_RPC_URLS[optimismSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version: baseSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      baseSepolia.id,
      true
    )
    const { version: optimismSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      optimismSepolia.id,
      true
    )

    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: baseSepoliaMcNexusVersion.implementationAddress
    })

    const optimismSepoliaAuth =
      await optimismSepoliaWalletClient.signAuthorization({
        contractAddress: optimismSepoliaMcNexusVersion.implementationAddress
      })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      // Both baseSepolia and optimismSepolia auth added manually.
      // order doesn't matter
      authorizations: [optimismSepoliaAuth, baseSepoliaAuth],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].eip7702Auth).not.toBeDefined()

    expect(quote.userOps[1].userOp.initCode).to.eq("0x")
    expect(quote.userOps[1].eip7702Auth).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.address).to.eq(
      baseSepoliaMcNexusVersion.implementationAddress
    )
    expect(quote.userOps[1].eip7702Auth?.chainId).to.eq(baseSepolia.id)
    expect(quote.userOps[1].eip7702Auth?.nonce).to.eq(baseSepoliaAuth.nonce)
    expect(quote.userOps[1].eip7702Auth?.r).to.eq(baseSepoliaAuth.r)
    expect(quote.userOps[1].eip7702Auth?.s).to.eq(baseSepoliaAuth.s)
    expect(quote.userOps[1].eip7702Auth?.yParity).to.eq(baseSepoliaAuth.yParity)

    expect(quote.userOps[2].userOp.initCode).to.eq("0x")
    expect(quote.userOps[2].eip7702Auth).toBeDefined()
    expect(quote.userOps[2].eip7702Auth?.address).to.eq(
      optimismSepoliaMcNexusVersion.implementationAddress
    )
    expect(quote.userOps[2].eip7702Auth?.chainId).to.eq(optimismSepolia.id)
    expect(quote.userOps[2].eip7702Auth?.nonce).to.eq(optimismSepoliaAuth.nonce)
    expect(quote.userOps[2].eip7702Auth?.r).to.eq(optimismSepoliaAuth.r)
    expect(quote.userOps[2].eip7702Auth?.s).to.eq(optimismSepoliaAuth.s)
    expect(quote.userOps[2].eip7702Auth?.yParity).to.eq(
      optimismSepoliaAuth.yParity
    )
  })

  test("Should SDK ignore manually signed 7702 auth if the userOps doesn't exist for the chain", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const optimismSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: optimismSepolia,
      transport: http(TESTNET_RPC_URLS[optimismSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version: baseSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      baseSepolia.id,
      true
    )
    const { version: optimismSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      optimismSepolia.id,
      true
    )

    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: baseSepoliaMcNexusVersion.implementationAddress
    })

    const optimismSepoliaAuth =
      await optimismSepoliaWalletClient.signAuthorization({
        contractAddress: optimismSepoliaMcNexusVersion.implementationAddress
      })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      // Both baseSepolia and optimismSepolia auth added manually.
      // order doesn't matter
      authorizations: [optimismSepoliaAuth, baseSepoliaAuth],
      instructions: [...baseSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].eip7702Auth).not.toBeDefined()

    expect(quote.userOps[1].userOp.initCode).to.eq("0x")
    expect(quote.userOps[1].eip7702Auth).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.address).to.eq(
      baseSepoliaMcNexusVersion.implementationAddress
    )
    expect(quote.userOps[1].eip7702Auth?.chainId).to.eq(baseSepolia.id)
    expect(quote.userOps[1].eip7702Auth?.nonce).to.eq(baseSepoliaAuth.nonce)
    expect(quote.userOps[1].eip7702Auth?.r).to.eq(baseSepoliaAuth.r)
    expect(quote.userOps[1].eip7702Auth?.s).to.eq(baseSepoliaAuth.s)
    expect(quote.userOps[1].eip7702Auth?.yParity).to.eq(baseSepoliaAuth.yParity)
  })

  test("Should SDK automatically inject one 7702 auth with chain id zero if the nonce on all the chains are same", async () => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    // Auth is only being signed manually here for comparision purposes
    const auth = await walletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: 0
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      multichain7702Auth: true,
      authorizations: [],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].eip7702Auth).not.toBeDefined()

    expect(quote.userOps[1].userOp.initCode).to.eq("0x")
    expect(quote.userOps[1].eip7702Auth).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.address).to.eq(
      version.implementationAddress
    )
    expect(quote.userOps[1].eip7702Auth?.chainId).to.eq(auth.chainId)
    expect(quote.userOps[1].eip7702Auth?.nonce).to.eq(auth.nonce)
    expect(quote.userOps[1].eip7702Auth?.r).to.eq(auth.r)
    expect(quote.userOps[1].eip7702Auth?.s).to.eq(auth.s)
    expect(quote.userOps[1].eip7702Auth?.yParity).to.eq(auth.yParity)

    expect(quote.userOps[2].userOp.initCode).to.eq("0x")
    expect(quote.userOps[2].eip7702Auth).toBeDefined()
    expect(quote.userOps[2].eip7702Auth?.address).to.eq(
      version.implementationAddress
    )
    expect(quote.userOps[2].eip7702Auth?.chainId).to.eq(auth.chainId)
    expect(quote.userOps[2].eip7702Auth?.nonce).to.eq(auth.nonce)
    expect(quote.userOps[2].eip7702Auth?.r).to.eq(auth.r)
    expect(quote.userOps[2].eip7702Auth?.s).to.eq(auth.s)
    expect(quote.userOps[2].eip7702Auth?.yParity).to.eq(auth.yParity)
  })

  test("Should SDK use manually injected 7702 auth with chain id zero for all chains if the nonce are same", async () => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const auth = await walletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: 0
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      delegate: true,
      multichain7702Auth: true,
      authorizations: [auth],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer],
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
        chainId: optimismSepolia.id
      }
    })

    expect(quote).toBeDefined()

    expect(quote.userOps[0].userOp.initCode).to.eq("0x")
    expect(quote.userOps[0].eip7702Auth).toBeDefined()

    expect(quote.userOps[1].userOp.initCode).to.eq("0x")
    expect(quote.userOps[1].eip7702Auth).toBeDefined()
    expect(quote.userOps[1].eip7702Auth?.address).to.eq(
      version.implementationAddress
    )
    expect(quote.userOps[1].eip7702Auth?.chainId).to.eq(auth.chainId)
    expect(quote.userOps[1].eip7702Auth?.nonce).to.eq(auth.nonce)
    expect(quote.userOps[1].eip7702Auth?.r).to.eq(auth.r)
    expect(quote.userOps[1].eip7702Auth?.s).to.eq(auth.s)
    expect(quote.userOps[1].eip7702Auth?.yParity).to.eq(auth.yParity)

    expect(quote.userOps[2].eip7702Auth).not.toBeDefined()
  })

  test("Should SDK throw an error if invalid 7702 auth is used", async () => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const invalidAuth = await walletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: 1 // Signing for ETH chain which makes it invalid for this sprtx
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    await expect(
      meeClient.getQuote({
        delegate: true,
        multichain7702Auth: true,
        authorizations: [invalidAuth],
        instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
          chainId: optimismSepolia.id
        }
      })
    ).rejects.toThrow(
      "Invalid authorizations: The nonce for some of the chains are same. Missing multichain authorization for the following chains: 11155420, 84532"
    )
  })

  test("Should SDK throw an error if 7702 auth is not sufficient for all the chains", async () => {
    const walletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const auth = await walletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: baseSepolia.id
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    await expect(
      meeClient.getQuote({
        delegate: true,
        multichain7702Auth: true,
        authorizations: [auth],
        instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
          chainId: optimismSepolia.id
        }
      })
    ).rejects.toThrow(
      "Invalid authorizations: The nonce for all the chains are not same. You need to pass specific authorizations for the following chains: 11155420"
    )
  })

  test("Should SDK throw an error if nonces on all the chains are same and custom 7702 auths are passed more than one", async () => {
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const optimismSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: optimismSepolia,
      transport: http(TESTNET_RPC_URLS[optimismSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: baseSepolia.id
    })

    const optimismSepoliaAuth =
      await optimismSepoliaWalletClient.signAuthorization({
        contractAddress: version.implementationAddress,
        chainId: optimismSepolia.id
      })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    await expect(
      meeClient.getQuote({
        delegate: true,
        multichain7702Auth: true,
        authorizations: [baseSepoliaAuth, optimismSepoliaAuth],
        instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
          chainId: optimismSepolia.id
        }
      })
    ).rejects.toThrow(
      "Invalid authorizations: The nonce for all the chains are zero and only one multichain authorization is expected"
    )
  })

  test("Should SDK throw an error if non zero chain id auth is passed for multichain and one chain sprtx", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: baseSepolia.id
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    await expect(
      meeClient.getQuote({
        delegate: true,
        multichain7702Auth: true,
        authorizations: [baseSepoliaAuth],
        instructions: [...baseSepoliaTransfer],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(baseSepolia.id),
          chainId: baseSepolia.id
        }
      })
    ).rejects.toThrow(
      "Invalid authorizations: Multichain authorization should be signed with chain ID zero"
    )
  })

  test("Should SDK throw an error for single chain authorization if the custom auth is not sufficient", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: baseSepolia.id
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    await expect(
      meeClient.getQuote({
        delegate: true,
        authorizations: [baseSepoliaAuth],
        instructions: [...baseSepoliaTransfer],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
          chainId: optimismSepolia.id
        }
      })
    ).rejects.toThrow(
      "Authorizations are missing for the following chains: 11155420"
    )
  })

  test("Should SDK throw an error for single chain authorization if the multichain auth is passed", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    const { version } = mcNexus.deploymentOn(baseSepolia.id, true)

    const multichainAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: version.implementationAddress,
      chainId: 0
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    await expect(
      meeClient.getQuote({
        delegate: true,
        authorizations: [multichainAuth],
        instructions: [...baseSepoliaTransfer],
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
          chainId: optimismSepolia.id
        }
      })
    ).rejects.toThrow(
      "Authorizations are missing for the following chains: 11155420, 84532"
    )
  })

  // Skipping the test because of RPC issue which fails to undelegate the EOA and it fails for AA13
  test.skip("Should execute multiple 7702 delegation supertx with manual single chain authorisations with sponsorship", async () => {
    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const optimismSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: optimismSepolia,
      transport: http(TESTNET_RPC_URLS[optimismSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    let isDelegated = await mcNexus.isDelegated()

    if (isDelegated) {
      await mcNexus.unDelegate()
      isDelegated = await mcNexus.isDelegated()
    }

    expect(isDelegated).toBe(false)

    const { version: baseSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      baseSepolia.id,
      true
    )

    const { version: optimismSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      optimismSepolia.id,
      true
    )

    const baseSepoliaAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: baseSepoliaMcNexusVersion.implementationAddress
    })

    const optimismSepoliaAuth =
      await optimismSepoliaWalletClient.signAuthorization({
        contractAddress: optimismSepoliaMcNexusVersion.implementationAddress
      })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      authorizations: [baseSepoliaAuth, optimismSepoliaAuth],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: 5
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    isDelegated = await mcNexus.isDelegated()

    expect(isDelegated).toBe(true)

    if (isDelegated) {
      await mcNexus.unDelegate()

      isDelegated = await mcNexus.isDelegated()
    }

    expect(isDelegated).toBe(false)
  })

  // Skipping the test because of RPC issue which fails to undelegate the EOA and it fails for AA13
  test.skip("Should execute multiple 7702 delegation supertx with authomatic auth and single chain auth", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    let isDelegated = await mcNexus.isDelegated()

    if (isDelegated) {
      await mcNexus.unDelegate()
      isDelegated = await mcNexus.isDelegated()
    }

    expect(isDelegated).toBe(false)

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 1n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      delegate: true,
      authorizations: [],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer],
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(optimismSepolia.id),
        chainId: optimismSepolia.id
      }
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: 5
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    isDelegated = await mcNexus.isDelegated()

    expect(isDelegated).toBe(true)

    if (isDelegated) {
      await mcNexus.unDelegate()

      isDelegated = await mcNexus.isDelegated()
    }

    expect(isDelegated).toBe(false)
  })

  test("Should execute multichain 7702 delegation supertx with manual multichain auth", async () => {
    // New account, so the nonce on all the chains are zero
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const baseSepoliaWalletClient = createWalletClient({
      account: eoaAccount,
      chain: baseSepolia,
      transport: http(TESTNET_RPC_URLS[baseSepolia.id])
    }).extend(publicActions)

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    let isDelegated = await mcNexus.isDelegated()
    expect(isDelegated).toBe(false)

    const { version: baseSepoliaMcNexusVersion } = mcNexus.deploymentOn(
      baseSepolia.id,
      true
    )

    const multichainAuth = await baseSepoliaWalletClient.signAuthorization({
      contractAddress: baseSepoliaMcNexusVersion.implementationAddress,
      chainId: 0
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 0n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 0n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      multichain7702Auth: true,
      authorizations: [multichainAuth],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote: quote })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: 5
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    isDelegated = await mcNexus.isDelegated()

    expect(isDelegated).toBe(true)
  })

  test("Should execute multichain 7702 delegation supertx with automatic auth", async () => {
    // New account, so the nonce on all the chains are zero
    const eoaAccount = privateKeyToAccount(generatePrivateKey())

    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: http(TESTNET_RPC_URLS[baseSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: http(TESTNET_RPC_URLS[optimismSepolia.id]),
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ],
      accountAddress: eoaAccount.address
    })

    let isDelegated = await mcNexus.isDelegated()
    expect(isDelegated).toBe(false)

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })

    const baseSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: baseSepolia.id,
        amount: 0n,
        tokenAddress: testnetMcTestUSDCP.addressOn(baseSepolia.id)
      }
    })

    const optimismSepoliaTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        recipient: eoaAccount.address,
        chainId: optimismSepolia.id,
        amount: 0n,
        tokenAddress: testnetMcTestUSDCP.addressOn(optimismSepolia.id)
      }
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      delegate: true,
      multichain7702Auth: true,
      authorizations: [],
      instructions: [...baseSepoliaTransfer, ...optimismSepoliaTransfer]
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote: quote })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: 5
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    isDelegated = await mcNexus.isDelegated()

    expect(isDelegated).toBe(true)
  })
})
