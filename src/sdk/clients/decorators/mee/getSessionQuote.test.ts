import type {
  Account,
  Address,
  Chain,
  Hex,
  LocalAccount,
  PublicClient,
  Transport,
  WalletClient
} from "viem"
import {
  http,
  createPublicClient,
  createWalletClient,
  getAbiItem,
  parseUnits,
  toFunctionSelector
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { generateNewTestnetMcNexusAccountAndMeeClient } from "../../../../test/mee-utils/generate-mc-nexus"
import { TESTNET_RPC_URLS, toNetwork } from "../../../../test/testSetup"
import {
  testnetMcTestUSDC,
  testnetMcTestUSDCP
} from "../../../../test/testTokens"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { SessionAction } from "../../../account/decorators/buildAction"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type {
  BaseGetSupertransactionReceiptPayload,
  FeeTokenInfo,
  Instruction,
  SessionDetail,
  TokenTrigger
} from "../../../clients/decorators/mee"
import { CounterAbi, DEFAULT_MEE_VERSION } from "../../../constants"
import { getMEEVersion } from "../../../modules"

describe("mee.getSessionQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  let redeemerAddress: Address
  let redeemerAccount: LocalAccount

  let paymentChainWalletClient: WalletClient<Transport, Chain, Account>
  let paymentChainPublicClient: PublicClient

  let feeToken: FeeTokenInfo
  let trigger: TokenTrigger

  const COUNTER_ON_BASE_SEPOLIA = "0xcaf661eeD95DE905Fcf5234040A7d6A70c6F5C85"
  const COUNTER_ON_OPTIMISM_SEPOLIA =
    "0x111EB1afF13be64d81485E7d45E70A6A0283dedE"

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!

    redeemerAccount = privateKeyToAccount(generatePrivateKey())
    redeemerAddress = redeemerAccount.address

    paymentChain = baseSepolia
    targetChain = optimismSepolia

    paymentChainTransport = http(TESTNET_RPC_URLS[baseSepolia.id])
    targetChainTransport = http(TESTNET_RPC_URLS[optimismSepolia.id])

    paymentChainPublicClient = createPublicClient({
      chain: paymentChain,
      transport: paymentChainTransport
    })

    paymentChainWalletClient = createWalletClient({
      account: eoaAccount,
      chain: paymentChain,
      transport: paymentChainTransport
    })

    feeToken = {
      address: testnetMcTestUSDCP.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    trigger = {
      tokenAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
      chainId: paymentChain.id,
      amount: parseUnits("1", 6)
    }
  })

  const getNewUserMcNexusAndMeeClient = async (options?: {
    use7702Auth?: boolean
  }) => {
    // New orchestrator account
    const { mcNexus, meeClient } =
      await generateNewTestnetMcNexusAccountAndMeeClient(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        {
          fundEoa: true,
          tokenType: "permit",
          amount: parseUnits("2", 6),
          ...(options?.use7702Auth ? { walletMode: "7702" } : {})
        }
      )

    return { mcNexus, meeClient }
  }

  const getRedeemerMcNexus = async (userMcNexusAddress: Address) => {
    return await toMultichainNexusAccount({
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: http(TESTNET_RPC_URLS[paymentChain.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: userMcNexusAddress
        },
        {
          chain: targetChain,
          transport: http(TESTNET_RPC_URLS[targetChain.id]),
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: userMcNexusAddress
        }
      ],
      signer: redeemerAccount
    })
  }

  const prepareAndEnableSession = async (
    meeClient: MeeClient,
    actions: SessionAction[],
    options?: {
      batchActions?: boolean
      use7702Auth?: boolean
    }
  ) => {
    const prepareAndEnableSessionQuote = await meeClient.getSessionQuote({
      mode: "PREPARE",
      enableSession: {
        redeemer: redeemerAddress,
        actions,
        batchActions: options?.batchActions
      },
      simulation: {
        simulate: true
      },
      delegate: options?.use7702Auth,
      authorization: [],
      feeToken,
      trigger
    })

    let sessionDetails: SessionDetail[] = []
    let txHash: Hex | undefined

    if (prepareAndEnableSessionQuote) {
      expect(prepareAndEnableSessionQuote).toBeDefined()

      const { hash } = await meeClient.executeSessionQuote(
        prepareAndEnableSessionQuote
      )

      expect(hash).toBeDefined()

      const { explorerLinks } = await meeClient.waitForSupertransactionReceipt({
        hash: hash
      })

      console.log("Prepare permissions and enable session: ", {
        explorerLinks
      })

      if (!prepareAndEnableSessionQuote.sessionDetails) {
        throw new Error("Missing session details")
      }

      sessionDetails = prepareAndEnableSessionQuote.sessionDetails
      txHash = hash
    }

    expect(sessionDetails).toBeDefined()

    return { sessionDetails, txHash }
  }

  const useSession = async (
    redeemerSignerMeeClient: MeeClient,
    instructions: Instruction[],
    sessionDetails: SessionDetail[]
  ) => {
    const useSessionQuote = await redeemerSignerMeeClient.getSessionQuote({
      mode: "USE",
      sessionDetails,
      simulation: {
        simulate: true
      },
      feeToken,
      instructions
    })

    expect(useSessionQuote).toBeDefined()

    const { hash } =
      await redeemerSignerMeeClient.executeSessionQuote(useSessionQuote)

    expect(hash).toBeDefined()

    const { explorerLinks } =
      await redeemerSignerMeeClient.waitForSupertransactionReceipt({
        hash
      })

    console.log("Use session: ", {
      explorerLinks
    })

    return hash
  }

  test("Smart sessions (New): should enable and use session with permissions across multiple chains", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
    )

    const actions = [
      mcNexus.buildAction({
        type: "custom",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: COUNTER_ON_BASE_SEPOLIA,
          functionSignature
        }
      }),
      mcNexus.buildAction({
        type: "custom",
        data: {
          chainIds: [targetChain.id],
          contractAddress: COUNTER_ON_OPTIMISM_SEPOLIA,
          functionSignature
        }
      })
    ].flat()

    const { sessionDetails } = await prepareAndEnableSession(meeClient, actions)

    const redeemerMcNexus = await getRedeemerMcNexus(
      mcNexus.addressOn(paymentChain.id, true)
    )

    const redeemerSignerMeeClient = await createMeeClient({
      account: redeemerMcNexus
    })

    const counterIncrementOne = await mcNexus.build({
      type: "default",
      data: {
        calls: [
          {
            to: COUNTER_ON_BASE_SEPOLIA,
            data: toFunctionSelector(
              getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
            )
          }
        ],
        chainId: paymentChain.id
      }
    })

    const counterIncrementTwo = await mcNexus.build({
      type: "default",
      data: {
        calls: [
          {
            to: COUNTER_ON_OPTIMISM_SEPOLIA,
            data: toFunctionSelector(
              getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
            )
          }
        ],
        chainId: targetChain.id
      }
    })

    await useSession(
      redeemerSignerMeeClient,
      [...counterIncrementOne, ...counterIncrementTwo],
      sessionDetails
    )
  })

  test("Smart sessions (New): Should enable and use session with permissions", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const actions = [
      mcNexus.buildAction({
        type: "transfer",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
          policies: [{ type: "sudo" }]
        }
      })
    ].flat()

    const { sessionDetails } = await prepareAndEnableSession(meeClient, actions)

    const redeemerMcNexus = await getRedeemerMcNexus(
      mcNexus.addressOn(paymentChain.id, true)
    )

    const redeemerSignerMeeClient = await createMeeClient({
      account: redeemerMcNexus
    })

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    await useSession(
      redeemerSignerMeeClient,
      [...tokenTransfer],
      sessionDetails
    )
  })

  test("Smart sessions (New): Should enable and use session with permissions with 7702 authorization", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient({
      use7702Auth: true
    })

    const actions = [
      mcNexus.buildAction({
        type: "transfer",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
          policies: [{ type: "sudo" }]
        }
      })
    ].flat()

    const { sessionDetails } = await prepareAndEnableSession(
      meeClient,
      actions,
      { use7702Auth: true }
    )

    const redeemerMcNexus = await getRedeemerMcNexus(
      mcNexus.addressOn(paymentChain.id, true)
    )

    const redeemerSignerMeeClient = await createMeeClient({
      account: redeemerMcNexus
    })

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    await useSession(
      redeemerSignerMeeClient,
      [...tokenTransfer],
      sessionDetails
    )
  })

  test("Smart sessions (New): Should enable session with multiple permissions (unbatched actions)", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const actions = [
      mcNexus.buildAction({
        type: "transfer",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
        }
      }),
      mcNexus.buildAction({
        type: "approve",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
        }
      }),
      mcNexus.buildAction({
        type: "transferFrom",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
        }
      })
    ].flat()

    const { txHash } = await prepareAndEnableSession(meeClient, actions, {
      batchActions: false
    })

    expect(txHash).toBeDefined()

    if (txHash) {
      const { userOps } =
        await meeClient.request<BaseGetSupertransactionReceiptPayload>({
          path: `explorer/${txHash}`,
          method: "GET"
        })

      // Payment userOps - 1
      // Install SS module, SCA deploy, funding userOps  - 2
      // Enable permission userOps - 3
      expect(userOps.length).to.be.eq(6)
    }
  })

  test("Smart sessions (New): Should enable session with explicitly batched and unbatched actions", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const approveAction = mcNexus.buildAction({
      type: "approve",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const transferAction = mcNexus.buildAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const transferFromAction = mcNexus.buildAction({
      type: "transferFrom",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const batchOne = mcNexus.buildAction({
      type: "batch",
      data: {
        actions: [...approveAction, ...transferFromAction]
      }
    })

    const actions = [...batchOne, ...transferAction]

    const { txHash } = await prepareAndEnableSession(meeClient, actions, {
      batchActions: false
    })

    expect(txHash).toBeDefined()

    if (txHash) {
      const { userOps } =
        await meeClient.request<BaseGetSupertransactionReceiptPayload>({
          path: `explorer/${txHash}`,
          method: "GET"
        })

      // Payment userOps - 1
      // Install SS module, SCA deploy, funding userOps  - 2
      // Enable permission userOps - 2
      expect(userOps.length).to.be.eq(5)
    }
  })
})
