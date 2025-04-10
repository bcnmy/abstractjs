import { getSpendingLimitsPolicy, getSudoPolicy } from "@rhinestone/module-sdk"
import {
  type Address,
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  toFunctionSelector
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type {
  Instruction,
  InstructionLike
} from "../../../clients/decorators/mee"
import { mcUSDC } from "../../../constants/tokens"
import { toDefaultModule } from "../../../modules/validators/default/toDefaultModule"
import { toOwnableModule } from "../../../modules/validators/ownable/toOwnableModule"
import { toSmartSessionsModule } from "../../../modules/validators/smartSessions/toSmartSessionsModule"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import { toInstallData } from "../../utils/toInstallData"
import buildMultichainInstructions from "./buildMultichainInstructions"

describe("mee.buildMultichainInstructions", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let redeemerAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let tokenAddress: Address
  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    redeemerAccount = privateKeyToAccount(generatePrivateKey())

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount,
      index: 2n
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  it("should build multichain instructions", async () => {
    const meeValidator = toDefaultModule({ signer: eoaAccount })
    const instructions: Instruction[] = await buildMultichainInstructions(
      { account: mcNexus, currentInstructions: [] },
      {
        type: "toInstallModuleCalls",
        parameters: toInstallData(meeValidator)
      }
    )
    expect(instructions.length).toBe(mcNexus.deployments.length)
  })

  it("should build multichain instructions with calls instead of a type", async () => {
    const instructions: Instruction[] = await buildMultichainInstructions(
      { account: mcNexus, currentInstructions: [] },
      {
        calls: [
          {
            to: tokenAddress,
            data: "0x"
          },
          {
            to: tokenAddress,
            data: "0x"
          }
        ]
      }
    )
    expect(instructions.length).toBe(mcNexus.deployments.length)
  })

  it("should install ownables, meeValidator and smartSessionValidator on several chains at once, and initialise each module on each chain", async () => {
    const meeValidator = toDefaultModule({ signer: eoaAccount })
    const smartSessionValidator = toSmartSessionsModule({ signer: eoaAccount })
    const ownableValidator = toOwnableModule({
      signer: eoaAccount,
      threshold: 1,
      owners: [eoaAccount.address]
    })

    const instructions: InstructionLike[] = await Promise.all([
      buildMultichainInstructions(
        { account: mcNexus, currentInstructions: [] },
        {
          type: "toInstallModuleCalls",
          parameters: toInstallData(meeValidator)
        }
      ),
      buildMultichainInstructions(
        { account: mcNexus, currentInstructions: [] },
        {
          type: "toInstallModuleCalls",
          parameters: toInstallData(smartSessionValidator)
        }
      ),
      buildMultichainInstructions(
        { account: mcNexus, currentInstructions: [] },
        {
          calls: [
            {
              to: tokenAddress,
              data: "0x"
            }
          ]
        }
      ),
      buildMultichainInstructions(
        { account: mcNexus, currentInstructions: [] },
        {
          type: "toInstallModuleCalls",
          parameters: toInstallData(ownableValidator)
        }
      ),
      buildMultichainInstructions(
        { account: mcNexus, currentInstructions: [] },
        {
          type: "toSetThresholdCalls",
          parameters: { threshold: 1 }
        }
      ),
      buildMultichainInstructions(
        { account: mcNexus, currentInstructions: [] },
        {
          type: "toEnableActionPoliciesCalls",
          parameters: {
            permissionId:
              "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
            actionPolicies: [
              {
                actionTargetSelector: toFunctionSelector(
                  "function ownerOf(uint256 tokenId)"
                ),
                actionTarget: tokenAddress,
                actionPolicies: [
                  getSudoPolicy(),
                  getSpendingLimitsPolicy([
                    { token: tokenAddress, limit: 100n }
                  ])
                ]
              }
            ]
          }
        }
      )
    ])

    const resolvedInstructions = await resolveInstructions(instructions)
    expect(resolvedInstructions.length).toBe(12)
  })
})
