import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { getSudoPolicy } from "@rhinestone/module-sdk"
import type { Address, Chain, LocalAccount, Transport } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { arbitrum } from "viem/chains"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainAddressMapping } from "../../../account/decorators/buildBridgeInstructions"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { toNexusAccount } from "../../../account/toNexusAccount"
import {
  DEFAULT_MEE_NODE_URL,
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { FeeTokenInfo } from "../../../clients/decorators/mee"
import { mcUSDC } from "../../../constants/tokens"
import type { Validator } from "../toValidator"
import { meeSessionActions } from "./decorators/mee"
import { toSmartSessionsModule } from "./toSmartSessionsModule"

describe("mee.multichainSmartSessions", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  let redeemerAddress: Address
  let redeemerAccount: LocalAccount

  let smartSessionsValidator: Validator

  let feeToken: FeeTokenInfo

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    redeemerAccount = privateKeyToAccount(generatePrivateKey())
    redeemerAddress = redeemerAccount.address

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    meeClient = await createMeeClient({
      account: mcNexus,
      url: DEFAULT_MEE_NODE_URL
    })
    smartSessionsValidator = toSmartSessionsModule({ signer: mcNexus.signer })
  })

  it("should not prepare the account that is already deployed and has the module installed", async () => {
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
  })

  it("should prepare the account for permissions", async () => {
    const freshNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount,
      index: BigInt(Date.now())
    })

    const freshMeeClient = await createMeeClient({
      account: freshNexus,
      url: DEFAULT_MEE_NODE_URL
    })

    const sessionMeeClient = freshMeeClient.extend(meeSessionActions)

    const transferToNexusTrigger = {
      tokenAddress: mcUSDC.addressOn(arbitrum.id), // The USDC token address on Base chain
      amount: 1n, // 1*10^-6 usdc
      chainId: arbitrum.id // Which chain this trigger executes on
    }

    const prepareForPermissionsPayload =
      await sessionMeeClient.prepareForPermissions({
        smartSessionsValidator,
        feeToken,
        trigger: transferToNexusTrigger
      })

    console.log(prepareForPermissionsPayload)
  })

  it("should grant and use multichain permissions for the account that is already deployed on all chains", async () => {
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
      // TODO: Could add a helper function to build the actions,
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
      ]
    })

    // overload account to use the redeemer account as signer
    // so using this entity one can sign userOps that have userOp.sender = mcNexus.address
    // with the redeemer account (which is Session Key) as signer
    // this would be a common pattern for signing userOps with a session key
    const dappNexusAccount = await toMultichainNexusAccount({
      accountAddress: mcNexus.addressOn(paymentChain.id),
      chains: [paymentChain, targetChain],
      transports,
      signer: redeemerAccount
    })

    const dappMeeClient = await createMeeClient({
      account: dappNexusAccount,
      url: DEFAULT_MEE_NODE_URL
    })
    const dappSessionClient = dappMeeClient.extend(meeSessionActions)

    const { hash } = await dappSessionClient.usePermission({
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
      ],
      feeToken
    })
  })
})
