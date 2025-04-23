import { COUNTER_ADDRESS } from "@biconomy/ecosystem"
import { getSudoPolicy } from "@rhinestone/module-sdk"
import {
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  toFunctionSelector
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainAddressMapping } from "../../../account/decorators/buildBridgeInstructions"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
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

    meeClient = await createMeeClient({ account: mcNexus })
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
      console.log({ installCalls })

      /**
       * Execute the install calls
       */

      // const hash = await meeClient.execute({
      //   instructions: installCalls,
      //   feeToken: {
      //     address: mcUSDC.addressOn(paymentChain.id),
      //     chainId: paymentChain.id
      //   },
      // })

      // const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
      // console.log({ receipt })
      // expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
    }

    const addressMapping: MultichainAddressMapping = {
      deployments: [
        {
          chainId: paymentChain.id,
          address: COUNTER_ADDRESS
        },
        {
          chainId: targetChain.id,
          address: COUNTER_ADDRESS
        }
      ],
      on: (chainId: number) => COUNTER_ADDRESS
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

    const instructions = await sessionMeeClient.usePermission({
      addressMapping,
      sessionDetails,
      mode: "ENABLE_AND_USE"
    })

    console.log({ instructions })

    // console.log(sessionDetails[0].enableSessionData)

    // const instructions: Instruction[] = await buildMultichainInstructions(
    //   { account: mcNexus, currentInstructions: [] },
    //   {
    //     type: "toInstallModuleCalls",
    //     parameters: toInstallData(smartSessionsValidator)
    //   }
    // )
    // expect(instructions.length).toBe(mcNexus.deployments.length)

    // const contractAddresses = {
    //   [paymentChain.id]: COUNTER_ADDRESS,
    //   [targetChain.id]: COUNTER_ADDRESS
    // }

    // const permissionData = await Promise.all(mcNexus.deployments.map((deployment) => {
    //   const contractAddress = contractAddresses[deployment?.client?.chain?.id as number];
    //   if (!contractAddress) {
    //     throw new Error(`No contract address found for chain ${deployment?.client?.chain?.id}`)
    //   }
    //   return grantPermission(undefined as AnyData, {
    //     account: deployment,
    //     redeemer: redeemerAddress,
    //     actions: [
    //       {
    //         actionTarget: contractAddress,
    //         actionTargetSelector: "0x273ea3e3",
    //         actionPolicies: [getSudoPolicy()]
    //       }
    //     ]
    //   })
    // }))
  })
})
