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
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import {
  type NetworkConfig,
  getBalance,
  setAllowance,
  transferErc20
} from "../../../../test/testUtils"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC, testnetMcUSDC } from "../../../constants/tokens"
import {
  DEFAULT_MEE_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
  DEFAULT_PATHFINDER_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import {
  CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION,
  DEFAULT_GAS_LIMIT,
  type FeeTokenInfo,
  type Instruction,
  getQuote
} from "./getQuote"

const getRandomAccountIndex = (min: number, max: number) => {
  const minValue = Math.ceil(min) // Round up to ensure inclusive min
  const maxValue = Math.floor(max) // Round down to ensure inclusive max
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
}

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
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount
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
      chains: [baseSepolia],
      signer: eoaAccount,
      transports: [http(TESTNET_RPC_URLS[baseSepolia.id])]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: DEFAULT_PATHFINDER_URL,
        gasTank: {
          address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
          token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
          chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
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
      chains: [paymentChain],
      signer: eoaAccount,
      transports: [paymentChainTransport]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
      chains: [paymentChain],
      signer: eoaAccount,
      transports: [paymentChainTransport],
      index: BigInt(getRandomAccountIndex(1000, 10000000000000))
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
      chains: [paymentChain],
      signer: eoaAccount,
      transports: [paymentChainTransport],
      index: BigInt(getRandomAccountIndex(1000, 10000000000000))
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
      chains: [paymentChain],
      signer: eoaAccount,
      transports: [paymentChainTransport],
      index: BigInt(getRandomAccountIndex(1000, 10000000000000))
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
        chains: [baseSepolia],
        signer: eoaAccount,
        transports: [http(TESTNET_RPC_URLS[baseSepolia.id])]
      })

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_PATHFINDER_URL,
          gasTank: {
            address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
            token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
            chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
          }
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
        chains: [paymentChain],
        signer: eoaAccount,
        transports: [paymentChainTransport]
      })

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
        chains: [baseSepolia],
        signer: eoaAccount,
        transports: [http(TESTNET_RPC_URLS[baseSepolia.id])],
        index: BigInt(getRandomAccountIndex(1000, 1000000000))
      })

      const nexusAccount = mcNexus.deploymentOn(baseSepolia.id, true)

      await expect(await nexusAccount.isDeployed()).to.eq(false)

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_PATHFINDER_URL,
          gasTank: {
            address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
            token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
            chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
          }
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
        chains: [baseSepolia],
        signer: eoaAccount,
        transports: [http(TESTNET_RPC_URLS[baseSepolia.id])],
        accountAddress: eoaAccount.address,
        index: BigInt(getRandomAccountIndex(1000, 1000000000))
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
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_PATHFINDER_URL,
          gasTank: {
            address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
            token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
            chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
          }
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
        chains: [baseSepolia],
        signer: eoaAccount,
        transports: [http(TESTNET_RPC_URLS[baseSepolia.id])]
      })

      const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

      const amountToTransfer = 1n

      const balanceBefore = await getBalance(
        publicClient,
        mcNexus.addressOn(baseSepolia.id, true),
        testnetMcUSDC.addressOn(baseSepolia.id)
      )

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
      })

      const quote = await meeClient.getFusionQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_PATHFINDER_URL,
          gasTank: {
            address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
            token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
            chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
          }
        },
        trigger: {
          amount: amountToTransfer,
          chainId: baseSepolia.id,
          tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id)
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
        testnetMcUSDC.addressOn(baseSepolia.id)
      )

      expect(balanceAfter).to.eq(balanceBefore + amountToTransfer)
    }
  )

  test.runIf(runPaidTests)(
    "Should execute quote for sponsored fusion super transaction for undeployed SCA case",
    async () => {
      const mcNexus = await toMultichainNexusAccount({
        chains: [baseSepolia],
        signer: eoaAccount,
        transports: [http(TESTNET_RPC_URLS[baseSepolia.id])],
        index: BigInt(getRandomAccountIndex(1000, 1000000000))
      })

      const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

      const amountToTransfer = 1n

      const balanceBefore = await getBalance(
        publicClient,
        eoaAccount.address,
        testnetMcUSDC.addressOn(baseSepolia.id)
      )

      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
      })

      const transferInx = await mcNexus.build({
        type: "transfer",
        data: {
          tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
          amount: amountToTransfer,
          chainId: baseSepolia.id,
          recipient: eoaAccount.address
        }
      })

      const quote = await meeClient.getFusionQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_PATHFINDER_URL,
          gasTank: {
            address: DEFAULT_MEE_TESTNET_SPONSORSHIP_PAYMASTER_ACCOUNT,
            token: DEFAULT_MEE_TESTNET_SPONSORSHIP_TOKEN_ADDRESS,
            chainId: DEFAULT_MEE_TESTNET_SPONSORSHIP_CHAIN_ID
          }
        },
        trigger: {
          amount: amountToTransfer,
          chainId: baseSepolia.id,
          tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id)
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
        testnetMcUSDC.addressOn(baseSepolia.id)
      )

      expect(balanceAfter).to.eq(balanceBefore)
    }
  )

  // This test will be always skipped. This test requires someone to run a sponsored backend service from starter kit repo
  test.skip("Should execute sponsored supertransaction with self hosted sponsorship backend (Testnet)", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [baseSepolia],
      signer: eoaAccount,
      transports: [http(TESTNET_RPC_URLS[baseSepolia.id])]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
      chains: [baseSepolia],
      signer: eoaAccount,
      transports: [http(TESTNET_RPC_URLS[baseSepolia.id])]
    })

    const meeClient = await createMeeClient({
      account: mcNexus,

      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
    })

    const quote = await meeClient.getFusionQuote({
      trigger: {
        tokenAddress: testnetMcUSDC.addressOn(baseSepolia.id),
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

  test("should use feePayer if provided", async () => {
    const chain = baseSepolia
    const mcNexus = await toMultichainNexusAccount({
      chains: [chain],
      signer: eoaAccount,
      transports: [http(TESTNET_RPC_URLS[chain.id])]
    })
    const meeClient = await createMeeClient({
      account: mcNexus
    })

    const tokenAddress = testnetMcUSDC.addressOn(chain.id)
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

    const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

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
    const approveGas = await publicClient.estimateGas(request)

    // Estimate current gas fees
    const gasFees = await publicClient.estimateFeesPerGas()

    // Add 300% buffer
    const totalGasWithBuffer = (approveGas * gasFees.maxFeePerGas * 300n) / 100n

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
})
