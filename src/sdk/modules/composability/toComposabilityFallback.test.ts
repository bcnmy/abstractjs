import type { Chain, LocalAccount, Transport } from "viem"
import { beforeAll, describe, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../test/testSetup"
import type { NetworkConfig } from "../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../account"
import { getComposabilityFactoryData } from "../../account/decorators/getFactoryData"
import { type MeeClient, createMeeClient } from "../../clients/createMeeClient"
import {
  BICONOMY_ATTESTER_ADDRESS,
  MEE_VALIDATOR_ADDRESS,
  RHINESTONE_ATTESTER_ADDRESS
} from "../../constants"
import { toComposabilityFallback } from "./toComposabilityFallback"

describe("modules.composabilityFallback", async () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should check composability factory data", async () => {
    const factoryData = await getComposabilityFactoryData({
      validatorAddress: MEE_VALIDATOR_ADDRESS,
      validatorInitData: eoaAccount.address,
      registryAddress: eoaAccount.address,
      attesters: [RHINESTONE_ATTESTER_ADDRESS, BICONOMY_ATTESTER_ADDRESS],
      attesterThreshold: 1
    })

    console.log({ factoryData })
  })

  test("should return the fallback module", () => {
    const fallback = toComposabilityFallback({ signer: eoaAccount })
  })
})
