import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  publicActions
} from "viem"
import { baseSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
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
  DEFAULT_STAGING_PATHFINDER_URL,
  type MeeClient,
  createMeeClient
} from "../../createMeeClient"
import {
  CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION,
  DEFAULT_GAS_LIMIT
} from "./getQuote"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"

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
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
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
      transports: [http()]
    })

    // TODO: Remove the url and API key once everything is moved into production
    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
      url: DEFAULT_STAGING_PATHFINDER_URL
    })

    const quote = await meeClient.getQuote({
      sponsorship: true,
      sponsorshipOptions: {
        url: DEFAULT_STAGING_PATHFINDER_URL,
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

  test("Should get quote for sponsored super transaction fail for unsupported sponshorship url", async () => {
    try {
      const mcNexus = await toMultichainNexusAccount({
        chains: [baseSepolia],
        signer: eoaAccount,
        transports: [http()]
      })

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
      })

      await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: "https://www.google.com",
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
    } catch (error) {
      expect(error.message).to.eq(
        "Self hosted sponsorship is not supported yet."
      )
    }
  })

  test("Should get quote for sponsored super transaction (Mainnet)", async () => {
    const mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain],
      signer: eoaAccount,
      transports: [http()]
    })

    // TODO: Remove the url and API key once everything is moved into production
    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
      url: DEFAULT_STAGING_PATHFINDER_URL
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
      transports: [http()],
      index: BigInt(getRandomAccountIndex(1000, 10000000000000))
    })

    // TODO: Remove the url and API key once everything is moved into production
    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
      url: DEFAULT_STAGING_PATHFINDER_URL
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
      transports: [http()],
      index: BigInt(getRandomAccountIndex(1000, 10000000000000))
    })

    // TODO: Remove the url and API key once everything is moved into production
    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
      url: DEFAULT_STAGING_PATHFINDER_URL
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
      transports: [http()],
      index: BigInt(getRandomAccountIndex(1000, 10000000000000))
    })

    // TODO: Remove the url and API key once everything is moved into production
    const meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
      url: DEFAULT_STAGING_PATHFINDER_URL
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
        transports: [http()]
      })

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_STAGING_PATHFINDER_URL,
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
        hash
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
        transports: [http()]
      })

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
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
        hash
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
        transports: [http()],
        index: BigInt(getRandomAccountIndex(1000, 1000000000))
      })

      const nexusAccount = mcNexus.deploymentOn(baseSepolia.id, true)

      await expect(await nexusAccount.isDeployed()).to.eq(false)

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_STAGING_PATHFINDER_URL,
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
        hash
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
        transports: [http()],
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
          confirmations: 2
        })
        isDelegated = await nexusAccount.isDelegated()
      }

      await expect(isDelegated).to.eq(false)

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
      })

      const quote = await meeClient.getQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_STAGING_PATHFINDER_URL,
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
        confirmations: 2
      })

      expect(receipt).toBeDefined()
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

      isDelegated = await nexusAccount.isDelegated()

      await expect(isDelegated).to.eq(true)

      if (isDelegated) {
        const txHash = await nexusAccount.unDelegate()
        await publicClient.waitForTransactionReceipt({
          hash: txHash,
          confirmations: 2
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
        transports: [http()]
      })

      const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

      const amountToTransfer = 1n

      const balanceBefore = await getBalance(
        publicClient,
        mcNexus.addressOn(baseSepolia.id, true),
        testnetMcUSDC.addressOn(baseSepolia.id)
      )

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
      })

      const quote = await meeClient.getFusionQuote({
        sponsorship: true,
        sponsorshipOptions: {
          url: DEFAULT_STAGING_PATHFINDER_URL,
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
        confirmations: 2
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
        transports: [http()],
        index: BigInt(getRandomAccountIndex(1000, 1000000000))
      })

      const { publicClient } = mcNexus.deploymentOn(baseSepolia.id, true)

      const amountToTransfer = 1n

      const balanceBefore = await getBalance(
        publicClient,
        eoaAccount.address,
        testnetMcUSDC.addressOn(baseSepolia.id)
      )

      // TODO: Remove the url and API key once everything is moved into production
      const meeClient = await createMeeClient({
        account: mcNexus,
        apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf",
        url: DEFAULT_STAGING_PATHFINDER_URL
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
          url: DEFAULT_STAGING_PATHFINDER_URL,
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
        confirmations: 2
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
})
