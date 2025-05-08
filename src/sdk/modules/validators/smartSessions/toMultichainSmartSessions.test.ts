import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { getSudoPolicy } from "@rhinestone/module-sdk"
import type { Address, Chain, LocalAccount, Transport } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
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

  it("should grant and use multichain permissions", async () => {
    const sessionMeeClient = meeClient.extend(meeSessionActions)
    expect(Object.keys(sessionMeeClient)).toContain("grantPermission")
    expect(Object.keys(sessionMeeClient)).toContain("usePermission")

    const isInstalledPayload = await mcNexus.read({
      type: "toIsModuleInstalledReads",
      parameters: smartSessionsValidator
    })

    const isInstalled = isInstalledPayload.every(Boolean)
    expect(isInstalled).toBeTypeOf("boolean")

    if (!isInstalled) {
      const installCalls = await mcNexus.build({
        type: "multichain",
        data: {
          type: "toInstallModuleCalls",
          parameters: smartSessionsValidator
        }
      })
      const { hash } = await meeClient.execute({
        instructions: installCalls,
        feeToken
      })

      const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      console.log({ receipt })
      expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    } else {
      console.log("Module already installed")
    }

    const COUNTER_ON_OPTIMISM = "0x167a039E79E4E90550333c7D97a12ebf5f6f116A"
    const COUNTER_ON_BASE = "0x3D9aEd944CC8cD91a89aa318efd6CDCD870241e8"

    const addressMapping: MultichainAddressMapping = {
      deployments: [
        {
          chainId: paymentChain.id,
          address: COUNTER_ON_OPTIMISM
        },
        {
          chainId: targetChain.id,
          address: COUNTER_ON_BASE
        }
      ],
      on: (chainId: number) => {
        if (chainId === paymentChain.id) return COUNTER_ON_OPTIMISM
        if (chainId === targetChain.id) return COUNTER_ON_BASE
        throw new Error("Invalid chain id")
      }
    }

    expect(addressMapping).toBeTypeOf("object")

    const sessionDetails = await sessionMeeClient.grantPermission({
      addressMapping,
      redeemer: redeemerAddress,
      actions: [
        {
          actionTargetSelector: "0x273ea3e3",
          actionPolicies: [getSudoPolicy()]
        }
      ]
    })

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
      addressMapping,
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
