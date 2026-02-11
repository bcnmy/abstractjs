import { getSudoPolicy, getUniversalActionPolicy } from "@rhinestone/module-sdk"
import type {
  Account,
  Address,
  Chain,
  LocalAccount,
  PublicClient,
  Transport,
  WalletClient
} from "viem"
import {
  http,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  getAbiItem,
  maxUint256,
  pad,
  parseUnits,
  toFunctionSelector,
  toHex
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { baseSepolia, optimismSepolia } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { prepareForTestnetSmartSessions } from "../../../../test/mee-utils/prepare-for-smart-session"
import {
  TESTNET_RPC_URLS,
  TEST_BLOCK_CONFIRMATIONS,
  toNetwork
} from "../../../../test/testSetup"
import {
  testnetMcTestUSDC,
  testnetMcTestUSDCP
} from "../../../../test/testTokens"
import { type NetworkConfig, transferErc20 } from "../../../../test/testUtils"
import { getMeeScanLink } from "../../../account"
import { buildAction } from "../../../account/decorators/buildAction"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import {
  type MeeClient,
  createMeeClient,
  getDefaultMEENetworkUrl,
  getDefaultMeeGasTank
} from "../../../clients/createMeeClient"
import { isModuleInstalled } from "../../../clients/decorators/erc7579/isModuleInstalled"
import type {
  BaseGetSupertransactionReceiptPayload,
  FeeTokenInfo
} from "../../../clients/decorators/mee"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { CounterAbi } from "../../../constants/abi/CounterAbi"
import { getMEEVersion } from "../../utils"
import type { AnyData } from "../../utils/Types"
import type { Validator } from "../toValidator"
import { meeSessionActions } from "./decorators/mee"
import type { GrantMeePermissionPayload } from "./decorators/mee/grantMeePermission"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

// const COUNTER_ON_OPTIMISM = "0x167a039E79E4E90550333c7D97a12ebf5f6f116A"
// const COUNTER_ON_BASE = "0x3D9aEd944CC8cD91a89aa318efd6CDCD870241e8"
const COUNTER_ON_BASE_SEPOLIA = "0xcaf661eeD95DE905Fcf5234040A7d6A70c6F5C85"
const COUNTER_ON_OPTIMISM_SEPOLIA = "0x111EB1afF13be64d81485E7d45E70A6A0283dedE"

enum ParamCondition {
  EQUAL = 0,
  GREATER_THAN = 1,
  LESS_THAN = 2,
  GREATER_THAN_OR_EQUAL = 3,
  LESS_THAN_OR_EQUAL = 4,
  NOT_EQUAL = 5,
  IN_RANGE = 6
}

describe("mee.multichainSmartSessions", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let paymentChainTransport: Transport
  let targetChainTransport: Transport

  let redeemerAddress: Address
  let redeemerAccount: LocalAccount

  let smartSessionsValidator: Validator

  let feeToken: FeeTokenInfo

  let grantMeePermissionPayload: GrantMeePermissionPayload

  let paymentChainWalletClient: WalletClient<Transport, Chain, Account>
  let paymentChainPublicClient: PublicClient

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!

    redeemerAccount = privateKeyToAccount(generatePrivateKey())
    redeemerAddress = redeemerAccount.address

    paymentChain = baseSepolia
    targetChain = optimismSepolia

    paymentChainTransport = http(TESTNET_RPC_URLS[baseSepolia.id])
    targetChainTransport = http(TESTNET_RPC_URLS[optimismSepolia.id])

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: BigInt(Date.now()),
      chainConfigurations: [
        {
          chain: baseSepolia,
          transport: paymentChainTransport,
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: optimismSepolia,
          transport: targetChainTransport,
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ]
    })

    feeToken = {
      address: testnetMcTestUSDCP.addressOn(baseSepolia.id),
      chainId: baseSepolia.id
    }

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
    smartSessionsValidator = toSmartSessionsModule({ signer: mcNexus.signer })

    paymentChainPublicClient = createPublicClient({
      chain: paymentChain,
      transport: paymentChainTransport
    })

    paymentChainWalletClient = createWalletClient({
      account: eoaAccount,
      chain: paymentChain,
      transport: paymentChainTransport
    })

    // send some USDC from eoaAccount to mcNexus on target chain
    const targetChainWalletClient = createWalletClient({
      chain: targetChain,
      transport: targetChainTransport,
      account: eoaAccount
    })

    await targetChainWalletClient.writeContract({
      address: testnetMcTestUSDCP.addressOn(targetChain.id),
      abi: erc20Abi,
      functionName: "transfer",
      args: [mcNexus.addressOn(targetChain.id, true), parseUnits("0.011", 6)]
    })
  })

  test("should prepare the undeployed account for permissions", async () => {
    const sessionMeeClient = meeClient.extend(meeSessionActions)

    // if tests fail, increase the amount
    const transferToNexusTrigger = {
      tokenAddress: testnetMcTestUSDCP.addressOn(paymentChain.id), // The USDC token address on Optimism chain
      amount: parseUnits("1", 6), // so Nexus is able to pay for the next SuperTxns
      chainId: paymentChain.id // Which chain this trigger executes on
    }

    // make random address
    const aliceAddress = privateKeyToAccount(generatePrivateKey()).address

    const additionalInstructions = await mcNexus.buildComposable({
      type: "approve",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(targetChain.id),
        amount: 12345n,
        chainId: targetChain.id,
        spender: aliceAddress
      }
    })

    const preparePayload = await sessionMeeClient.prepareForPermissions({
      smartSessionsValidator,
      feeToken,
      trigger: transferToNexusTrigger,
      additionalInstructions
    })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash: preparePayload?.hash!,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    for (const receipt_ of receipt.receipts) {
      expect(receipt_.status).toBe("success")
      expect(receipt_.logs).toBeDefined()
    }

    for (const deployment of mcNexus.deployments) {
      expect(await deployment.isDeployed()).toBe(true)
      const isInstalled = await isModuleInstalled(undefined as AnyData, {
        account: deployment,
        module: {
          address: smartSessionsValidator.address,
          initData: "0x",
          type: smartSessionsValidator.type
        }
      })
      expect(isInstalled).toBe(true)
    }
    // check approved amount on the target chain
    const client = createPublicClient({
      chain: targetChain,
      transport: targetChainTransport
    })
    const approvedAmount = await client.readContract({
      address: testnetMcTestUSDCP.addressOn(targetChain.id),
      abi: erc20Abi,
      functionName: "allowance",
      args: [mcNexus.addressOn(targetChain.id)!, aliceAddress]
    })
    expect(approvedAmount).toBe(12345n)
  })

  test("should not prepare the account that is already deployed and has the module installed", async () => {
    // check that all deployments are deployed
    const isDeployed = await Promise.all(
      mcNexus.deployments.map((deployment) => deployment.isDeployed())
    )
    expect(isDeployed.every(Boolean)).toBe(true)

    const sessionMeeClient = meeClient.extend(meeSessionActions)
    expect(Object.keys(sessionMeeClient)).toContain("prepareForPermissions")
    expect(Object.keys(sessionMeeClient)).toContain(
      "grantPermissionPersonalSign"
    )
    expect(Object.keys(sessionMeeClient)).toContain(
      "grantPermissionTypedDataSign"
    )
    expect(Object.keys(sessionMeeClient)).toContain("usePermission")

    // check that the module is installed on all chains
    const isInstalledPayload = await mcNexus.read({
      type: "toIsModuleInstalledReads",
      parameters: smartSessionsValidator
    })
    const isInstalled = isInstalledPayload.every(Boolean)
    expect(isInstalled).toBe(true)

    // check that prepareForPermissions returns undefined => means no preparation was done
    const prepareForPermissionsPayload =
      await sessionMeeClient.prepareForPermissions({
        smartSessionsValidator,
        feeToken
      })
    expect(prepareForPermissionsPayload).toBeUndefined()
  })

  test("should grant and use multichain permissions for the account that is already deployed on all chains", async () => {
    const sessionMeeClient = meeClient.extend(meeSessionActions)

    // ======== At this point the Nexus SA is already deployed and SS is installed ==============
    const prepareForPermissionsPayload =
      await sessionMeeClient.prepareForPermissions({
        smartSessionsValidator,
        feeToken
      })
    expect(prepareForPermissionsPayload).toBeUndefined()

    const sessionDetails = await sessionMeeClient.grantPermissionTypedDataSign({
      redeemer: redeemerAddress,
      feeToken,
      // Could add a helper function to build the actions array,
      // this architecture allows for more flexibility and customizations
      actions: [
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: targetChain.id,
          actionTarget: COUNTER_ON_BASE_SEPOLIA
        }
      ],
      maxPaymentAmount: parseUnits("3", 6)
    })

    // overload account to use the redeemer account as signer
    // so using this entity one can sign userOps that have userOp.sender = mcNexus.address
    // with the redeemer account (which is Session Key) as signer
    // this would be a common pattern for signing userOps with a session key
    const dappNexusAccount = await toMultichainNexusAccount({
      signer: redeemerAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(paymentChain.id)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(targetChain.id)
        }
      ]
    })

    const dappMeeClient = await createMeeClient({
      account: dappNexusAccount
    })
    const dappSessionClient = dappMeeClient.extend(meeSessionActions)

    const usePermissionPayload = await dappSessionClient.usePermission({
      sessionDetails,
      mode: "ENABLE_AND_USE",
      instructions: [
        {
          calls: [
            {
              to: COUNTER_ON_OPTIMISM_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              )
            }
          ],
          chainId: paymentChain.id
        },
        {
          calls: [
            {
              to: COUNTER_ON_BASE_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              )
            }
          ],
          chainId: targetChain.id
        }
      ],
      feeToken
    })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash: usePermissionPayload?.hash!,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    for (const receipt_ of receipt.receipts) {
      expect(receipt_.status).toBe("success")
      expect(receipt_.logs).toBeDefined()
    }

    grantMeePermissionPayload = sessionDetails
  })

  test("should check if the permissions are enabled", async () => {
    const sessionMeeClient = meeClient.extend(meeSessionActions)

    const expectedEnabledPermissionsOnChains = grantMeePermissionPayload.map(
      (permission) => {
        return {
          permissionId: permission.permissionId,
          chainId: Number(
            permission.enableSessionData.enableSession.sessionToEnable.chainId
          )
        }
      }
    )

    for (const permissionOnChain of expectedEnabledPermissionsOnChains) {
      const isEnabled = await sessionMeeClient.isPermissionEnabled({
        permissionId: permissionOnChain.permissionId,
        chainId: permissionOnChain.chainId
      })
      expect(isEnabled).toBe(true)
    }

    const enabledPermissionsReturn =
      await sessionMeeClient.checkEnabledPermissions(grantMeePermissionPayload)

    for (const permissionOnChain of expectedEnabledPermissionsOnChains) {
      expect(
        enabledPermissionsReturn[permissionOnChain.permissionId][
          permissionOnChain.chainId
        ]
      ).toBe(true)
    }

    const invalidChainId = expectedEnabledPermissionsOnChains[1].chainId
    expect(invalidChainId).not.toBe(
      expectedEnabledPermissionsOnChains[0].chainId
    )
    expect(
      sessionMeeClient.account.deploymentOn(invalidChainId, false)
    ).toBeDefined()
    let isEnabled = await sessionMeeClient.isPermissionEnabled({
      permissionId: expectedEnabledPermissionsOnChains[0].permissionId,
      chainId: invalidChainId
    })
    expect(isEnabled).toBe(false)

    const invalidPermissionId = `0x${(BigInt(expectedEnabledPermissionsOnChains[0].permissionId) + 1n).toString(16).padStart(64, "0")}`
    isEnabled = await sessionMeeClient.isPermissionEnabled({
      permissionId: invalidPermissionId as `0x${string}`,
      chainId: expectedEnabledPermissionsOnChains[0].chainId
    })
    expect(isEnabled).toBe(false)
  })

  test("should grant and use permission with custom verification gas limit and universal action policy", async () => {
    const publicClient = createPublicClient({
      chain: targetChain,
      transport: targetChainTransport
    })
    const redeemerUSDCBalanceBefore = await publicClient.readContract({
      address: testnetMcTestUSDCP.addressOn(targetChain.id),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [redeemerAddress]
    })

    const sessionMeeClient = meeClient.extend(meeSessionActions)

    const EMPTY_RAW_RULE = {
      condition: ParamCondition.EQUAL,
      offset: 0n,
      isLimited: false,
      ref: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
      usage: { limit: 0n, used: 0n }
    }

    const uniActionPolicyInfoUSDC = getUniversalActionPolicy({
      valueLimitPerUse: maxUint256,
      paramRules: {
        length: 2n,
        rules: [
          {
            condition: ParamCondition.EQUAL,
            isLimited: false,
            offset: 0n,
            ref: pad(redeemerAddress),
            usage: { limit: 0n, used: 0n }
          },
          {
            condition: ParamCondition.LESS_THAN_OR_EQUAL,
            isLimited: true,
            offset: 32n,
            ref: pad(toHex(parseUnits("3", 6))),
            usage: { limit: parseUnits("100", 6), used: 0n }
          },
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE,
          EMPTY_RAW_RULE
        ]
      }
    })

    const sessionDetails = await sessionMeeClient.grantPermissionTypedDataSign({
      redeemer: redeemerAddress,
      feeToken,
      // Could add a helper function to build the actions array,
      // this architecture allows for more flexibility and customizations
      actions: [
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "revertOperation" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "getNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: erc20Abi, name: "approve" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: testnetMcTestUSDCP.addressOn(paymentChain.id)
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: erc20Abi, name: "transfer" })
          ),
          actionPolicies: [uniActionPolicyInfoUSDC],
          chainId: targetChain.id,
          actionTarget: testnetMcTestUSDCP.addressOn(targetChain.id)
        }
      ],
      maxPaymentAmount: parseUnits("3", 6)
    })

    const dappNexusAccount = await toMultichainNexusAccount({
      signer: redeemerAccount,
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(paymentChain.id)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(targetChain.id)
        }
      ]
    })

    const dappMeeClient = await createMeeClient({
      account: dappNexusAccount
    })
    const dappSessionClient = dappMeeClient.extend(meeSessionActions)

    const usePermissionPayload = await dappSessionClient.usePermission({
      sessionDetails,
      mode: "ENABLE_AND_USE",
      instructions: [
        {
          calls: [
            {
              to: COUNTER_ON_OPTIMISM_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              )
            }
          ],
          chainId: paymentChain.id
        },
        {
          calls: [
            {
              to: COUNTER_ON_OPTIMISM_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
              )
            }
          ],
          chainId: paymentChain.id
        },
        {
          calls: [
            {
              to: testnetMcTestUSDCP.addressOn(paymentChain.id),
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [redeemerAddress, parseUnits("0.01", 6)]
              })
            }
          ],
          chainId: paymentChain.id
        },
        // transfer USDC from from orchestrator to redeemer on target chain
        // this is to test that the action policy via universal action policy
        // is created successfully
        {
          calls: [
            {
              to: testnetMcTestUSDCP.addressOn(targetChain.id),
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [redeemerAddress, parseUnits("0.01", 6)]
              })
            }
          ],
          chainId: targetChain.id
        }
      ],
      feeToken,
      verificationGasLimit: 3_000_000n
    })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash: usePermissionPayload?.hash!,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    for (const receipt_ of receipt.receipts) {
      expect(receipt_.status).toBe("success")
      expect(receipt_.logs).toBeDefined()
    }

    const redeemerUSDCBalanceAfter = await publicClient.readContract({
      address: testnetMcTestUSDCP.addressOn(targetChain.id),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [redeemerAddress]
    })

    expect(redeemerUSDCBalanceAfter).toBe(
      redeemerUSDCBalanceBefore + parseUnits("0.01", 6)
    )
  })

  test("should grant and use multichain permissions with sponsorship", async () => {
    const sessionMeeClient = meeClient.extend(meeSessionActions)

    const prepareForPermissionsPayload =
      await sessionMeeClient.prepareForPermissions({
        smartSessionsValidator,
        sponsorship: true,
        sponsorshipOptions: {
          url: getDefaultMEENetworkUrl(true),
          gasTank: getDefaultMeeGasTank(true)
        }
      })

    expect(prepareForPermissionsPayload).toBeUndefined()

    const sessionDetails = await sessionMeeClient.grantPermissionPersonalSign({
      redeemer: redeemerAddress,
      actions: [
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: COUNTER_ON_OPTIMISM_SEPOLIA
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: erc20Abi, name: "transfer" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: paymentChain.id,
          actionTarget: testnetMcTestUSDCP.addressOn(paymentChain.id)
        },
        {
          actionTargetSelector: toFunctionSelector(
            getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
          ),
          actionPolicies: [getSudoPolicy()],
          chainId: targetChain.id,
          actionTarget: COUNTER_ON_BASE_SEPOLIA
        }
      ]
    })

    const dappNexusAccount = await toMultichainNexusAccount({
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(paymentChain.id)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(DEFAULT_MEE_VERSION),
          accountAddress: mcNexus.addressOn(targetChain.id)
        }
      ],
      signer: redeemerAccount
    })

    const dappMeeClient = await createMeeClient({
      account: dappNexusAccount,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
    const dappSessionClient = dappMeeClient.extend(meeSessionActions)

    const usePermissionPayload = await dappSessionClient.usePermission({
      sponsorship: true,
      sponsorshipOptions: {
        url: getDefaultMEENetworkUrl(true),
        gasTank: getDefaultMeeGasTank(true)
      },
      verificationGasLimit: 2_000_000n,
      sessionDetails,
      mode: "ENABLE_AND_USE",
      instructions: [
        {
          calls: [
            {
              to: testnetMcTestUSDCP.addressOn(paymentChain.id),
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [redeemerAddress, parseUnits("0.001", 6)]
              })
            }
          ],
          chainId: paymentChain.id
        },
        {
          calls: [
            {
              to: COUNTER_ON_OPTIMISM_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              )
            }
          ],
          chainId: paymentChain.id
        },
        {
          calls: [
            {
              to: COUNTER_ON_OPTIMISM_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
              )
            }
          ],
          chainId: paymentChain.id
        },
        {
          calls: [
            {
              to: COUNTER_ON_BASE_SEPOLIA,
              data: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              )
            }
          ],
          chainId: targetChain.id
        }
      ]
    })

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash: usePermissionPayload?.hash!,
      confirmations: TEST_BLOCK_CONFIRMATIONS
    })

    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Smart sessions flow: Enable and use mode (Legacy) should work for backwards compatibility", async () => {
    const { sessionDetails, sessionAccount, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "legacy"
      )

    const sessionSignerMeeClient = await createMeeClient({
      account: sessionAccount
    })

    const sessionSignerSessionMeeClient =
      sessionSignerMeeClient.extend(meeSessionActions)

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    const executionPayload = await sessionSignerSessionMeeClient.usePermission({
      sessionDetails,
      mode: "ENABLE_AND_USE",
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      instructions: [...tokenTransfer]
    })

    await sessionSignerMeeClient.waitForSupertransactionReceipt({
      hash: executionPayload.hash
    })

    console.log({ explorerLink: getMeeScanLink(executionPayload.hash) })
  })

  test("Smart sessions flow: enable session via preparePermissions flow + ENABLE_AND_USE mode should fail", async () => {
    const { sessionDetails, sessionAccount, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "new"
      )

    const sessionSignerMeeClient = await createMeeClient({
      account: sessionAccount
    })

    const sessionSignerSessionMeeClient =
      sessionSignerMeeClient.extend(meeSessionActions)

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    await expect(
      sessionSignerSessionMeeClient.usePermission({
        sessionDetails,
        mode: "ENABLE_AND_USE",
        simulation: {
          simulate: true
        },
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(paymentChain.id),
          chainId: paymentChain.id
        },
        instructions: [...tokenTransfer]
      })
    ).rejects.toThrowError(
      "ENABLE_AND_USE mode cannot be used with given session details, instead try USE mode directly"
    )
  })

  test("Smart sessions flow: enable session via preparePermissions flow + USE mode should work", async () => {
    const { sessionDetails, sessionAccount, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "new"
      )

    const sessionSignerMeeClient = await createMeeClient({
      account: sessionAccount
    })

    const sessionSignerSessionMeeClient =
      sessionSignerMeeClient.extend(meeSessionActions)

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    const executionPayload = await sessionSignerSessionMeeClient.usePermission({
      sessionDetails,
      mode: "USE",
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      instructions: [...tokenTransfer]
    })

    await sessionSignerMeeClient.waitForSupertransactionReceipt({
      hash: executionPayload.hash
    })

    console.log({ explorerLink: getMeeScanLink(executionPayload.hash) })
  })

  test("Smart sessions flow: Enable and use mode (Legacy) + 7702 AUTH should work", async () => {
    const { sessionDetails, sessionAccount, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "legacy",
        true // use7702 mode
      )

    const sessionSignerMeeClient = await createMeeClient({
      account: sessionAccount
    })

    const sessionSignerSessionMeeClient =
      sessionSignerMeeClient.extend(meeSessionActions)

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    const executionPayload = await sessionSignerSessionMeeClient.usePermission({
      sessionDetails,
      mode: "ENABLE_AND_USE",
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      instructions: [...tokenTransfer]
    })

    await sessionSignerMeeClient.waitForSupertransactionReceipt({
      hash: executionPayload.hash
    })

    console.log({ explorerLink: getMeeScanLink(executionPayload.hash) })
  })

  test("Smart sessions flow: enable session via preparePermissions flow + USE mode + 7702 AUTH should work", async () => {
    const { sessionDetails, sessionAccount, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "new",
        true // use7702 mode
      )

    const sessionSignerMeeClient = await createMeeClient({
      account: sessionAccount
    })

    const sessionSignerSessionMeeClient =
      sessionSignerMeeClient.extend(meeSessionActions)

    const tokenTransfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
        recipient: eoaAccount.address,
        amount: 0n,
        chainId: paymentChain.id
      }
    })

    const executionPayload = await sessionSignerSessionMeeClient.usePermission({
      sessionDetails,
      mode: "USE",
      simulation: {
        simulate: true
      },
      feeToken: {
        address: testnetMcTestUSDCP.addressOn(paymentChain.id),
        chainId: paymentChain.id
      },
      instructions: [...tokenTransfer]
    })

    await sessionSignerMeeClient.waitForSupertransactionReceipt({
      hash: executionPayload.hash
    })

    console.log({ explorerLink: getMeeScanLink(executionPayload.hash) })
  })

  test("Smart sessions flow: erc20 spending limit action", async () => {
    const actions = [
      buildAction({
        type: "erc20SpendingLimit",
        data: {
          chainIds: [paymentChain.id],
          contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
          recipientAddress: "0x0000000000000000000000000000000000000001",
          limitPerAction: parseUnits("0.5", 6),
          maxLimit: parseUnits("0.5", 6)
        }
      })
    ].flat()

    const { sessionDetails, sessionAccount, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "new",
        true, // use7702 mode
        actions
      )

    // transfer usdc to the fee account
    await transferErc20({
      publicClient: paymentChainPublicClient,
      walletClient: paymentChainWalletClient,
      tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
      recipient: mcNexus.addressOn(paymentChain.id, true),
      amount: parseUnits("1", 6)
    })

    const sessionSignerMeeClient = await createMeeClient({
      account: sessionAccount
    })

    const sessionSignerSessionMeeClient =
      sessionSignerMeeClient.extend(meeSessionActions)

    const actionInstructions = [
      // Valid instruction which satisfies all the policy constraints
      {
        isValid: true,
        instructions: await mcNexus.build({
          type: "transfer",
          data: {
            tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
            recipient: "0x0000000000000000000000000000000000000001",
            amount: parseUnits("0.5", 6),
            chainId: paymentChain.id
          }
        })
      },
      // Invalid: Recipient address contraint failure
      {
        isValid: false,
        instructions: await mcNexus.build({
          type: "transfer",
          data: {
            tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
            recipient: "0x0000000000000000000000000000000000000002",
            amount: parseUnits("0.5", 6),
            chainId: paymentChain.id
          }
        })
      },
      // Invalid: Amount spending limit constraint failure
      {
        isValid: false,
        instructions: await mcNexus.build({
          type: "transfer",
          data: {
            tokenAddress: testnetMcTestUSDC.addressOn(paymentChain.id),
            recipient: "0x0000000000000000000000000000000000000001",
            amount: parseUnits("2", 6),
            chainId: paymentChain.id
          }
        })
      }
    ]

    for await (const { instructions, isValid } of actionInstructions) {
      const executionPromise = sessionSignerSessionMeeClient.usePermission({
        sessionDetails,
        mode: "USE",
        simulation: {
          simulate: true
        },
        feeToken: {
          address: testnetMcTestUSDCP.addressOn(paymentChain.id),
          chainId: paymentChain.id
        },
        instructions
      })

      if (isValid) {
        const executionPayload = await executionPromise

        await sessionSignerMeeClient.waitForSupertransactionReceipt({
          hash: executionPayload.hash
        })

        console.log({ explorerLink: getMeeScanLink(executionPayload.hash) })
      } else {
        // Policy Violation Reverts with pre simulations
        await expect(executionPromise).rejects.toThrowError(
          "UserOp [1] simulation failed. Revert reason: Execution reverted at contract 0x00000000008bdaba73cd9815d79069c247eb4bda and reverted with error selector 0x3b577361"
        )
      }
    }
  })

  test("Smart sessions enable permission with actions unbatched", async () => {
    const { prepareForPermissionsHash, mcNexus } =
      await prepareForTestnetSmartSessions(
        paymentChain,
        targetChain,
        paymentChainPublicClient,
        paymentChainWalletClient,
        eoaAccount,
        "new",
        false,
        undefined,
        false
      )

    expect(prepareForPermissionsHash).toBeDefined()

    if (prepareForPermissionsHash) {
      const { userOps } =
        await meeClient.request<BaseGetSupertransactionReceiptPayload>({
          path: `explorer/${prepareForPermissionsHash}`,
          method: "GET"
        })

      // Payment userOps - 1
      // Install SS module, SCA deploy, funding userOps  - 2
      // Enable permission userOps - 3
      expect(userOps.length).to.be.eq(6)
    }
  })

  test("Smart sessions enable permission with custom actions batching", async () => {
    const approveAction = buildAction({
      type: "approve",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const transferAction = buildAction({
      type: "transfer",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const transferFromAction = buildAction({
      type: "transferFrom",
      data: {
        chainIds: [paymentChain.id],
        contractAddress: testnetMcTestUSDC.addressOn(paymentChain.id)
      }
    })

    const batchOne = buildAction({
      type: "batch",
      data: {
        actions: [...approveAction, ...transferFromAction]
      }
    })

    const { prepareForPermissionsHash } = await prepareForTestnetSmartSessions(
      paymentChain,
      targetChain,
      paymentChainPublicClient,
      paymentChainWalletClient,
      eoaAccount,
      "new",
      false,
      [...batchOne, ...transferAction],
      false
    )

    expect(prepareForPermissionsHash).toBeDefined()

    if (prepareForPermissionsHash) {
      const { userOps } =
        await meeClient.request<BaseGetSupertransactionReceiptPayload>({
          path: `explorer/${prepareForPermissionsHash}`,
          method: "GET"
        })

      // Payment userOps - 1
      // Install SS module, SCA deploy, funding userOps  - 2
      // Enable permission userOps - 2
      expect(userOps.length).to.be.eq(5)
    }
  })
})
