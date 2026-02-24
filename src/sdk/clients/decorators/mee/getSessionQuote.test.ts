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
  decodeAbiParameters,
  erc20Abi,
  getAbiItem,
  parseUnits,
  toFunctionSelector
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { assert, beforeAll, describe, expect, test } from "vitest"
import { generateNewTestnetMcNexusAccountAndMeeClient } from "../../../../test/mee-utils/generate-mc-nexus"
import { TESTNET_RPC_URLS, toNetwork } from "../../../../test/testSetup"
import {
  testnetMcTestUSDC,
  testnetMcTestUSDCP
} from "../../../../test/testTokens"
import { type NetworkConfig, getBalance } from "../../../../test/testUtils"
import {
  UniversalPolicyAbi,
  type UniversalPolicyData,
  calldataArgument,
  getUniversalActionPolicyConditionType
} from "../../../account"
import type {
  SessionAction,
  SessionActionLike
} from "../../../account/decorators/buildSessionAction"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import {
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../../clients/createMeeClient"
import {
  type BaseGetSupertransactionReceiptPayload,
  type FeeTokenInfo,
  type Instruction,
  type SessionDetail,
  type TokenTrigger,
  addPaymentPolicyForActions
} from "../../../clients/decorators/mee"
import {
  CounterAbi,
  DEFAULT_MEE_VERSION,
  SMART_SESSIONS_ADDRESS,
  SmartSessionMode,
  UNIVERSAL_ACTION_POLICY_ADDRESS
} from "../../../constants"
import {
  type AnyData,
  getMEEVersion,
  meeSessionActions
} from "../../../modules"
import { isModuleInstalled } from "../erc7579"

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
    useSponsorship?: boolean
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
          ...(options?.useSponsorship
            ? { sponsorship: true }
            : {
                fundEoa: true,
                tokenType: "permit",
                amount: parseUnits("2", 6)
              }),
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
    actions: SessionActionLike[],
    options?: {
      batchActions?: boolean
      use7702Auth?: boolean
      useSponsorship?: boolean
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
      ...(options?.use7702Auth
        ? {
            delegate: true,
            authorizations: []
          }
        : { delegate: false }),
      ...(options?.useSponsorship
        ? {
            sponsorship: true,
            sponsorshipOptions: {
              url: getDefaultMEENetworkUrl(true),
              gasTank: getDefaultMeeGasTank(true)
            }
          }
        : { feeToken, trigger })
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
        assert(false, "Missing session details")
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
    sessionDetails: SessionDetail[],
    options?: {
      useSponsorship?: boolean
    }
  ) => {
    const useSessionQuote = await redeemerSignerMeeClient.getSessionQuote({
      mode: "USE",
      sessionDetails,
      simulation: {
        simulate: true
      },
      ...(options?.useSponsorship
        ? {
            sponsorship: true,
            sponsorshipOptions: {
              url: getDefaultMEENetworkUrl(true),
              gasTank: getDefaultMeeGasTank(true)
            }
          }
        : { feeToken }),
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

  const resolveUniversalActionPolicyData = (
    sessionActions: SessionAction[]
  ) => {
    const transferSelector = toFunctionSelector(
      getAbiItem({ abi: erc20Abi, name: "transfer" })
    )

    for (const { actions } of sessionActions) {
      for (const action of actions) {
        if (
          action.actionTargetSelector.toLowerCase() ===
            transferSelector.toLowerCase() &&
          action.actionTarget.toLowerCase() === feeToken.address.toLowerCase()
        ) {
          for (const actionPolicy of action.actionPolicies) {
            if (
              actionPolicy.policy.toLowerCase() ===
              UNIVERSAL_ACTION_POLICY_ADDRESS.toLowerCase()
            ) {
              const policyData = decodeAbiParameters(
                UniversalPolicyAbi,
                actionPolicy.initData
              )

              const universalPolicyData = policyData[0] as UniversalPolicyData

              return universalPolicyData
            }
          }
        }
      }
    }

    return undefined
  }

  test("Smart sessions (New): Should SS validator module installed, SCA deployed, SCA funded and permissions are enabled", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const sessionsClient = meeClient.extend(meeSessionActions)

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        policies: [{ type: "sudo" }]
      }
    })

    const { sessionDetails } = await prepareAndEnableSession(meeClient, actions)

    for (const deployment of mcNexus.deployments) {
      expect(await deployment.isDeployed()).toBe(true)

      const isInstalled = await isModuleInstalled(undefined as AnyData, {
        account: deployment,
        module: {
          address: SMART_SESSIONS_ADDRESS,
          initData: "0x",
          type: "validator"
        }
      })

      expect(isInstalled).toBe(true)
    }

    const balance = await getBalance(
      paymentChainPublicClient,
      mcNexus.addressOn(paymentChain.id, true),
      testnetMcTestUSDCP.addressOn(paymentChain.id)
    )

    expect(balance).to.eq(trigger.amount)

    const enabledPermissionDetails = sessionDetails.map((permission) => {
      return {
        permissionId: permission.permissionId,
        chainId: Number(
          permission.enableSessionData.enableSession.sessionToEnable.chainId
        )
      }
    })

    for (const { permissionId, chainId } of enabledPermissionDetails) {
      const isEnabled = await sessionsClient.isPermissionEnabled({
        permissionId,
        chainId
      })

      expect(isEnabled).toBe(true)
    }

    const enabledPermissionsDetailsResult =
      await sessionsClient.checkEnabledPermissions(sessionDetails)

    for (const { permissionId, chainId } of enabledPermissionDetails) {
      expect(enabledPermissionsDetailsResult[permissionId][chainId]).toBe(true)
    }
  })

  test("Smart sessions (New): Should not prepare a session quote if SCA and SS module are already deployed/installed, with no additional instructions or funding request", async () => {
    // New orchestrator account
    const { meeClient } = await getNewUserMcNexusAndMeeClient()

    const quote = await meeClient.getSessionQuote({
      mode: "PREPARE",
      simulation: {
        simulate: true
      },
      feeToken,
      trigger
    })

    if (!quote) {
      assert(false, "Failed to fetch prepare session quote")
    }

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeSessionQuote(quote)

    expect(hash).toBeDefined()

    await meeClient.waitForSupertransactionReceipt({
      hash
    })

    expect(
      await meeClient.getSessionQuote({
        mode: "PREPARE",
        simulation: {
          simulate: true
        },
        feeToken
      })
    ).toBeUndefined()
  })

  test("Smart sessions (New): Should ENABLE_AND_USE mode fails", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const redeemerMcNexus = await getRedeemerMcNexus(
      mcNexus.addressOn(paymentChain.id, true)
    )

    const redeemerSignerMeeClient = await createMeeClient({
      account: redeemerMcNexus
    })

    await expect(
      useSession(
        redeemerSignerMeeClient,
        [],
        [{ mode: SmartSessionMode.UNSAFE_ENABLE } as SessionDetail]
      )
    ).rejects.toThrowError(
      "ENABLE_AND_USE mode is not supported, session details is invalid."
    )
  })

  test("Smart sessions (New): should enable and use session with permissions across multiple chains", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const functionSignature = toFunctionSelector(
      getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
    )

    const actions = [
      mcNexus.buildSessionAction({
        type: "custom",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: COUNTER_ON_BASE_SEPOLIA,
          functionSignature
        }
      }),
      mcNexus.buildSessionAction({
        type: "custom",
        data: {
          chainIds: [targetChain.id],
          contractAddress: COUNTER_ON_OPTIMISM_SEPOLIA,
          functionSignature
        }
      })
    ]

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

  test("Smart sessions (New): Should enable and use session with permissions in single chain", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient()

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        policies: [{ type: "sudo" }]
      }
    })

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

  test("Smart sessions (New): Should enable and use session with permissions with 7702 authorizations and delegation", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient({
      use7702Auth: true
    })

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        policies: [{ type: "sudo" }]
      }
    })

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
      mcNexus.buildSessionAction({
        type: "transfer",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
        }
      }),
      mcNexus.buildSessionAction({
        type: "approve",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
        }
      }),
      mcNexus.buildSessionAction({
        type: "transferFrom",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
        }
      })
    ]

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

    const approveAction = mcNexus.buildSessionAction({
      type: "approve",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const transferAction = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const transferFromAction = mcNexus.buildSessionAction({
      type: "transferFrom",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const batchOne = mcNexus.buildSessionAction({
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

  test("Smart sessions (New): Should enable and use session works with sponshorship", async () => {
    // New orchestrator account
    const { mcNexus, meeClient } = await getNewUserMcNexusAndMeeClient({
      useSponsorship: true
    })

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        policies: [{ type: "sudo" }]
      }
    })

    const { sessionDetails } = await prepareAndEnableSession(
      meeClient,
      actions,
      { useSponsorship: true }
    )

    const redeemerMcNexus = await getRedeemerMcNexus(
      mcNexus.addressOn(paymentChain.id, true)
    )

    const redeemerSignerMeeClient = await createMeeClient({
      account: redeemerMcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
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
      sessionDetails,
      { useSponsorship: true }
    )
  })

  test("Smart sessions (New): Should payment policy should be added if missing", async () => {
    // New orchestrator account
    const { mcNexus } = await getNewUserMcNexusAndMeeClient()

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDCP.addressOn(paymentChain.id)
      }
    })

    const resolvedActions = addPaymentPolicyForActions(
      actions,
      feeToken,
      parseUnits("5", 6)
    )

    const policyData = resolveUniversalActionPolicyData(resolvedActions)

    if (!policyData) {
      assert(false, "Payment policy not added")
    }

    expect(policyData.paramRules.length).to.eq(1n)
    expect(policyData.paramRules.rules[0].offset).to.eq(calldataArgument(2))
    expect(policyData.paramRules.rules[0].condition).to.eq(
      getUniversalActionPolicyConditionType("lessThanOrEqual")
    )
    expect(BigInt(policyData.paramRules.rules[0].ref)).to.eq(parseUnits("5", 6))
  })

  test("Smart sessions (New): Should payment policy amount updated in existing universal policy rule", async () => {
    // New orchestrator account
    const { mcNexus } = await getNewUserMcNexusAndMeeClient()

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
        maxAmountLimit: parseUnits("1", 6),
        amountLimitPerAction: parseUnits("1", 6)
      }
    })

    const resolvedActions = addPaymentPolicyForActions(
      actions,
      feeToken,
      parseUnits("5", 6)
    )

    const policyData = resolveUniversalActionPolicyData(resolvedActions)

    if (!policyData) {
      assert(false, "Payment policy not added")
    }

    expect(policyData.paramRules.length).to.eq(1n)
    expect(policyData.paramRules.rules[0].offset).to.eq(calldataArgument(2))
    expect(policyData.paramRules.rules[0].condition).to.eq(
      getUniversalActionPolicyConditionType("lessThanOrEqual")
    )
    expect(BigInt(policyData.paramRules.rules[0].ref)).to.eq(parseUnits("6", 6))
    expect(policyData.paramRules.rules[0].isLimited).to.eq(true)
    expect(policyData.paramRules.rules[0].usage.limit).to.eq(parseUnits("6", 6))
  })

  test("Smart sessions (New): Should payment policy amount rule to be added in existing universal policy rules", async () => {
    // New orchestrator account
    const { mcNexus } = await getNewUserMcNexusAndMeeClient()

    const actions = mcNexus.buildSessionAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDCP.addressOn(paymentChain.id),
        recipientAddress: "0x0000000000000000000000000000000000000123"
      }
    })

    const resolvedActions = addPaymentPolicyForActions(
      actions,
      feeToken,
      parseUnits("5", 6)
    )

    const policyData = resolveUniversalActionPolicyData(resolvedActions)

    if (!policyData) {
      assert(false, "Payment policy not added")
    }

    expect(policyData.paramRules.length).to.eq(2n)
    expect(policyData.paramRules.rules[1].offset).to.eq(calldataArgument(2))
    expect(policyData.paramRules.rules[1].condition).to.eq(
      getUniversalActionPolicyConditionType("lessThanOrEqual")
    )
    expect(BigInt(policyData.paramRules.rules[1].ref)).to.eq(parseUnits("5", 6))
    expect(policyData.paramRules.rules[1].isLimited).to.eq(false)
    expect(policyData.paramRules.rules[1].usage.limit).to.eq(0n)
  })
})
