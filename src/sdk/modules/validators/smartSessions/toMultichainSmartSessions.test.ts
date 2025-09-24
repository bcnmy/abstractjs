import { getSudoPolicy, getUniversalActionPolicy } from "@rhinestone/module-sdk"
import type { Address, Chain, LocalAccount, Transport } from "viem"
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
  toHex,
  zeroAddress
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, inject, test } from "vitest"
import {
  TEST_BLOCK_CONFIRMATIONS,
  getTestChainConfig,
  toNetwork
} from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import { isModuleInstalled } from "../../../clients/decorators/erc7579/isModuleInstalled"
import type { FeeTokenInfo } from "../../../clients/decorators/mee"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { CounterAbi } from "../../../constants/abi/CounterAbi"
import { mcUSDC } from "../../../constants/tokens"
import { getMEEVersion } from "../../utils"
import type { AnyData } from "../../utils/Types"
import type { Validator } from "../toValidator"
import { meeSessionActions } from "./decorators/mee"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

// @ts-ignore
const { runPaidTests } = inject("settings")
const COUNTER_ON_OPTIMISM = "0x167a039E79E4E90550333c7D97a12ebf5f6f116A"
const COUNTER_ON_BASE = "0x3D9aEd944CC8cD91a89aa318efd6CDCD870241e8"
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

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[
      [paymentChain, targetChain],
      [paymentChainTransport, targetChainTransport]
    ] = getTestChainConfig(network)

    eoaAccount = network.account!
    redeemerAccount = privateKeyToAccount(generatePrivateKey())
    redeemerAddress = redeemerAccount.address

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      index: BigInt(Date.now()),
      chainConfigurations: [
        {
          chain: paymentChain,
          transport: paymentChainTransport,
          version: getMEEVersion(MEEVersion.V2_1_0)
        },
        {
          chain: targetChain,
          transport: targetChainTransport,
          version: getMEEVersion(MEEVersion.V2_1_0)
        }
      ]
    })

    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
    })
    smartSessionsValidator = toSmartSessionsModule({ signer: mcNexus.signer })

    // send some USDC from eoaAccount to mcNexus on target chain
    const eoaWalletClient = createWalletClient({
      chain: targetChain,
      transport: targetChainTransport,
      account: eoaAccount
    })
    await eoaWalletClient.writeContract({
      address: mcUSDC.addressOn(targetChain.id),
      abi: erc20Abi,
      functionName: "transfer",
      args: [mcNexus.addressOn(targetChain.id, true), parseUnits("0.011", 6)]
    })
  })

  test.runIf(runPaidTests)(
    "should prepare the undeployed account for permissions",
    async () => {
      const sessionMeeClient = meeClient.extend(meeSessionActions)

      // if tests fail, increase the amount
      const transferToNexusTrigger = {
        tokenAddress: mcUSDC.addressOn(paymentChain.id), // The USDC token address on Optimism chain
        amount: parseUnits("0.5", 6), // so Nexus is able to pay for the next SuperTxns
        chainId: paymentChain.id // Which chain this trigger executes on
      }

      // make random address
      const aliceAddress = privateKeyToAccount(generatePrivateKey()).address

      const additionalInstructions = await mcNexus.build({
        type: "approve",
        data: {
          tokenAddress: mcUSDC.addressOn(targetChain.id),
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
        address: mcUSDC.addressOn(targetChain.id),
        abi: erc20Abi,
        functionName: "allowance",
        args: [mcNexus.addressOn(targetChain.id)!, aliceAddress]
      })
      expect(approvedAmount).toBe(12345n)
    }
  )

  test.runIf(runPaidTests)(
    "should not prepare the account that is already deployed and has the module installed",
    async () => {
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
    }
  )

  test.runIf(runPaidTests)(
    "should grant and use multichain permissions for the account that is already deployed on all chains",
    async () => {
      const sessionMeeClient = meeClient.extend(meeSessionActions)

      // ======== At this point the Nexus SA is already deployed and SS is installed ==============
      const prepareForPermissionsPayload =
        await sessionMeeClient.prepareForPermissions({
          smartSessionsValidator,
          feeToken
        })
      expect(prepareForPermissionsPayload).toBeUndefined()

      const sessionDetails =
        await sessionMeeClient.grantPermissionTypedDataSign({
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
              actionTarget: COUNTER_ON_OPTIMISM
            },
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              ),
              actionPolicies: [getSudoPolicy()],
              chainId: targetChain.id,
              actionTarget: COUNTER_ON_BASE
            }
          ],
          maxPaymentAmount: parseUnits("3", 6)
        })

      // overload account to use the redeemer account as signer
      // so using this entity one can sign userOps that have userOp.sender = mcNexus.address
      // with the redeemer account (which is Session Key) as signer
      // this would be a common pattern for signing userOps with a session key
      const dappNexusAccount = await toMultichainNexusAccount({
        accountAddress: mcNexus.addressOn(paymentChain.id),
        signer: redeemerAccount,
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
                to: COUNTER_ON_OPTIMISM,
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
                to: COUNTER_ON_BASE,
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
    }
  )

  test.runIf(runPaidTests)(
    "should grant and use permission with custom verification gas limit and universal action policy",
    async () => {
      const publicClient = createPublicClient({
        chain: targetChain,
        transport: targetChainTransport
      })
      const redeemerUSDCBalanceBefore = await publicClient.readContract({
        address: mcUSDC.addressOn(targetChain.id),
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

      const sessionDetails =
        await sessionMeeClient.grantPermissionTypedDataSign({
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
              actionTarget: COUNTER_ON_OPTIMISM
            },
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
              ),
              actionPolicies: [getSudoPolicy()],
              chainId: paymentChain.id,
              actionTarget: COUNTER_ON_OPTIMISM
            },
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "revertOperation" })
              ),
              actionPolicies: [getSudoPolicy()],
              chainId: paymentChain.id,
              actionTarget: COUNTER_ON_OPTIMISM
            },
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "getNumber" })
              ),
              actionPolicies: [getSudoPolicy()],
              chainId: paymentChain.id,
              actionTarget: COUNTER_ON_OPTIMISM
            },
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: erc20Abi, name: "transfer" })
              ),
              actionPolicies: [uniActionPolicyInfoUSDC],
              chainId: targetChain.id,
              actionTarget: mcUSDC.addressOn(targetChain.id)
            }
          ],
          maxPaymentAmount: parseUnits("3", 6)
        })

      const dappNexusAccount = await toMultichainNexusAccount({
        accountAddress: mcNexus.addressOn(paymentChain.id),
        signer: redeemerAccount,
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
                to: COUNTER_ON_OPTIMISM,
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
                to: COUNTER_ON_OPTIMISM,
                data: toFunctionSelector(
                  getAbiItem({ abi: CounterAbi, name: "decrementNumber" })
                )
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
                to: mcUSDC.addressOn(targetChain.id),
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
        address: mcUSDC.addressOn(targetChain.id),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [redeemerAddress]
      })

      expect(redeemerUSDCBalanceAfter).toBe(
        redeemerUSDCBalanceBefore + parseUnits("0.01", 6)
      )
    }
  )

  test.runIf(runPaidTests)(
    "should grant and use multichain permissions with sponsorship",
    async () => {
      const sessionMeeClient = meeClient.extend(meeSessionActions)

      const prepareForPermissionsPayload =
        await sessionMeeClient.prepareForPermissions({
          smartSessionsValidator,
          feeToken
        })
      expect(prepareForPermissionsPayload).toBeUndefined()

      const sessionDetails = await sessionMeeClient.grantPermissionPersonalSign(
        {
          redeemer: redeemerAddress,
          actions: [
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              ),
              actionPolicies: [getSudoPolicy()],
              chainId: paymentChain.id,
              actionTarget: COUNTER_ON_OPTIMISM
            },
            {
              actionTargetSelector: toFunctionSelector(
                getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
              ),
              actionPolicies: [getSudoPolicy()],
              chainId: targetChain.id,
              actionTarget: COUNTER_ON_BASE
            }
          ]
        }
      )

      const dappNexusAccount = await toMultichainNexusAccount({
        accountAddress: mcNexus.addressOn(paymentChain.id),
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
        sessionDetails,
        mode: "ENABLE_AND_USE",
        instructions: [
          {
            calls: [
              {
                to: COUNTER_ON_BASE,
                data: toFunctionSelector(
                  getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
                )
              }
            ],
            chainId: targetChain.id
          },
          {
            calls: [
              {
                to: COUNTER_ON_OPTIMISM,
                data: toFunctionSelector(
                  getAbiItem({ abi: CounterAbi, name: "incrementNumber" })
                )
              }
            ],
            chainId: paymentChain.id
          }
        ]
      })

      const receipt = await meeClient.waitForSupertransactionReceipt({
        hash: usePermissionPayload?.hash!,
        confirmations: TEST_BLOCK_CONFIRMATIONS
      })

      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }
  )
})
