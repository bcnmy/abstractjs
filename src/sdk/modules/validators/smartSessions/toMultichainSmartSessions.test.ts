import { getSudoPolicy } from "@rhinestone/module-sdk"
import type { Address, Chain, Client, LocalAccount, Transport } from "viem"
import { http, createPublicClient, erc20Abi, parseUnits } from "viem"
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
import { mcUSDC } from "../../../constants/tokens"
import type { ModularSmartAccount } from "../../utils/Types"
import type { Validator } from "../toValidator"
import { meeSessionActions } from "./decorators/mee"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

// @ts-ignore
const { runPaidTests } = inject("settings")

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
      chains: [paymentChain, targetChain],
      transports: [paymentChainTransport, targetChainTransport],
      signer: eoaAccount,
      index: BigInt(Date.now())
    })

    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    meeClient = await createMeeClient({
      account: mcNexus,
      apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
    })
    smartSessionsValidator = toSmartSessionsModule({ signer: mcNexus.signer })
  })

  test.runIf(runPaidTests)(
    "should prepare the undeployed account for permissions",
    async () => {
      const sessionMeeClient = meeClient.extend(meeSessionActions)

      const transferToNexusTrigger = {
        tokenAddress: mcUSDC.addressOn(paymentChain.id), // The USDC token address on Base chain
        amount: parseUnits("0.07", 6), // 0.07 usdc => so Nexus is able to pay for the next SuperTxns
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
        const isInstalled = await isModuleInstalled(
          deployment.client as Client<
            Transport,
            Chain | undefined,
            ModularSmartAccount
          >,
          {
            account: deployment,
            module: {
              address: smartSessionsValidator.address,
              initData: "0x",
              type: smartSessionsValidator.type
            }
          }
        )
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
      expect(Object.keys(sessionMeeClient)).toContain("grantPermission")
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

      const COUNTER_ON_OPTIMISM = "0x167a039E79E4E90550333c7D97a12ebf5f6f116A"
      const COUNTER_ON_BASE = "0x3D9aEd944CC8cD91a89aa318efd6CDCD870241e8"

      const sessionDetails = await sessionMeeClient.grantPermission({
        redeemer: redeemerAddress,
        feeToken,
        // Could add a helper function to build the actions array,
        // this architecture allows for more flexibility and customizations
        actions: [
          {
            actionTargetSelector: "0x273ea3e3",
            actionPolicies: [getSudoPolicy()],
            chainId: paymentChain.id,
            actionTarget: COUNTER_ON_OPTIMISM
          },
          {
            actionTargetSelector: "0x273ea3e3",
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
        chains: [paymentChain, targetChain],
        transports: [paymentChainTransport, targetChainTransport],
        signer: redeemerAccount
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
                data: "0x273ea3e3"
              }
            ],
            chainId: paymentChain.id
          },
          {
            calls: [
              {
                to: COUNTER_ON_BASE,
                data: "0x273ea3e3"
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
    "should grant and use multichain permissions with sponsorship",
    async () => {
      const sessionMeeClient = meeClient.extend(meeSessionActions)

      const prepareForPermissionsPayload =
        await sessionMeeClient.prepareForPermissions({
          smartSessionsValidator,
          feeToken
        })
      expect(prepareForPermissionsPayload).toBeUndefined()

      const COUNTER_ON_OPTIMISM = "0x167a039E79E4E90550333c7D97a12ebf5f6f116A"
      const COUNTER_ON_BASE = "0x3D9aEd944CC8cD91a89aa318efd6CDCD870241e8"

      const sessionDetails = await sessionMeeClient.grantPermission({
        redeemer: redeemerAddress,
        actions: [
          {
            actionTargetSelector: "0x273ea3e3",
            actionPolicies: [getSudoPolicy()],
            chainId: paymentChain.id,
            actionTarget: COUNTER_ON_OPTIMISM
          },
          {
            actionTargetSelector: "0x273ea3e3",
            actionPolicies: [getSudoPolicy()],
            chainId: targetChain.id,
            actionTarget: COUNTER_ON_BASE
          }
        ]
      })

      const dappNexusAccount = await toMultichainNexusAccount({
        accountAddress: mcNexus.addressOn(paymentChain.id),
        chains: [paymentChain, targetChain],
        transports: [paymentChainTransport, targetChainTransport],
        signer: redeemerAccount
      })

      const dappMeeClient = await createMeeClient({
        account: dappNexusAccount,
        apiKey: "mee_3ZLvzYAmZa89WLGa3gmMH8JJ"
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
                to: COUNTER_ON_OPTIMISM,
                data: "0x273ea3e3"
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
