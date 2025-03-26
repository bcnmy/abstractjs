import {
  COUNTER_ADDRESS,
  MEE_VALIDATOR_ADDRESS,
  OWNABLE_VALIDATOR_ADDRESS,
  SMART_SESSION_ADDRESS
} from "@biconomy/ecosystem"
import {
  http,
  type Chain,
  type LocalAccount,
  type PublicClient,
  createPublicClient
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { afterAll, beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../test/testSetup"
import { killNetwork } from "../test/testUtils"
import type { NetworkConfig } from "../test/testUtils"
import { toNexusAccount } from "./account/toNexusAccount"
import {
  type NexusClient,
  createSmartAccountClient
} from "./clients/createBicoBundlerClient"
import { debugUserOperation } from "./clients/decorators/smartAccount/debugUserOperation"
import {
  type Session,
  SmartSessionMode,
  encodeSmartSessionSignature,
  encodeValidationData,
  getAccount,
  getEnableSessionDetails,
  getOwnableValidatorMockSignature,
  getSmartSessionsModule,
  getSudoPolicy
} from "./constants"
import { type ModularSmartAccount, generateSalt } from "./modules"

describe("smartSessions.joe", async () => {
  let network: NetworkConfig
  let chain: Chain
  let bundlerUrl: string
  let publicClient: PublicClient
  let eoaAccount: LocalAccount
  let dappAccount: LocalAccount
  let nexusAccount: ModularSmartAccount
  let nexusClient: NexusClient
  const index = 0n

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    chain = network.chain
    bundlerUrl = network.bundlerUrl
    eoaAccount = network.account!
    dappAccount = privateKeyToAccount(`0x${process.env.PRIVATE_KEY_TWO}`)
    publicClient = createPublicClient({ chain, transport: http() })

    nexusAccount = await toNexusAccount({
      signer: eoaAccount,
      chain,
      transport: http(network.rpcUrl),
      index
    })
    nexusClient = createSmartAccountClient({
      account: nexusAccount,
      transport: http(bundlerUrl)
    })
  })
  afterAll(async () => {
    await killNetwork([network?.rpcPort, network?.bundlerPort])
  })

  test("should demo a basic smart session usage", async () => {
    const isDeployed = await nexusAccount.isDeployed()
    console.log({ isDeployed })

    if (!isDeployed) {
      const hash = await nexusClient.installModule({
        module: getSmartSessionsModule({ useRegistry: false })
      })
      const result = await nexusClient.waitForUserOperationReceipt({ hash })
      expect(result.success).toBe("true")
    }

    const session: Session = {
      sessionValidator: OWNABLE_VALIDATOR_ADDRESS,
      permitERC4337Paymaster: false,
      sessionValidatorInitData: encodeValidationData({
        threshold: 1,
        owners: [dappAccount.address]
      }),
      salt: generateSalt(),
      userOpPolicies: [],
      erc7739Policies: {
        allowedERC7739Content: [],
        erc1271Policies: []
      },
      actions: [
        {
          actionTarget: COUNTER_ADDRESS,
          actionTargetSelector: "0x273ea3e3", // incrementNumber
          actionPolicies: [getSudoPolicy()]
        }
      ],
      chainId: BigInt(chain.id)
    }

    const nexusAccountForRhinestone = getAccount({
      address: await nexusAccount.getAddress(),
      type: "nexus"
    })

    console.log({ session, nexusAccountForRhinestone })

    const sessionDetailsWithPermissionEnableHash =
      await getEnableSessionDetails({
        enableMode: SmartSessionMode.UNSAFE_ENABLE,
        sessions: [session],
        account: nexusAccountForRhinestone,
        clients: [publicClient],
        enableValidatorAddress: MEE_VALIDATOR_ADDRESS
      })

    const { permissionEnableHash, ...sessionDetails } =
      sessionDetailsWithPermissionEnableHash

    if (!sessionDetails.enableSessionData?.enableSession.permissionEnableSig) {
      throw new Error("enableSessionData is undefined")
    }

    const rawPermissionEnableSig = await eoaAccount.signMessage({
      message: { raw: permissionEnableHash }
    })

    sessionDetails.enableSessionData.enableSession.permissionEnableSig =
      rawPermissionEnableSig

    const calls = [
      {
        to: session.actions[0].actionTarget,
        data: session.actions[0].actionTargetSelector
      }
    ]

    sessionDetails.signature = getOwnableValidatorMockSignature({
      threshold: 1
    })
    const regularSig = encodeSmartSessionSignature(sessionDetails)

    const userOperation = await debugUserOperation(nexusClient, {
      verificationGasLimit: 10000000n,
      callGasLimit: 10000000n,
      preVerificationGas: 100000000n,
      account: nexusAccount,
      calls,
      signature: regularSig,
      nonce: await nexusAccount.getNonce({
        // @ts-ignore
        moduleAddress: SMART_SESSION_ADDRESS
      })
    })

    const userOpHashToSign = nexusClient.account.getUserOpHash(userOperation)

    sessionDetails.signature = await dappAccount.signMessage({
      message: { raw: userOpHashToSign }
    })
    userOperation.signature = encodeSmartSessionSignature(sessionDetails)

    const userOpHash = await nexusClient.sendUserOperation(userOperation)
    const receipt = await nexusClient.waitForUserOperationReceipt({
      hash: userOpHash
    })

    console.log({ receipt })
  })
})
