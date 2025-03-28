import {
  type Address,
  type Chain,
  type LocalAccount,
  type Transport,
  erc20Abi,
  parseUnits
} from "viem"
import { beforeAll, describe, expect, it } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import type { Instruction } from "../../../clients/decorators/mee/getQuote"
import { mcUSDC } from "../../../constants/tokens"
import { greaterThanOrEqualTo, runtimeERC20BalanceOf } from "../../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"
import buildComposable from "./buildComposable"

describe("mee.buildComposable", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

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

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
  })

  it("should highlight building composable instructions", async () => {
    const instructions: Instruction[] = await buildComposable(
      { account: mcNexus },
      {
        to: tokenAddress,
        abi: erc20Abi,
        params: {
          type: "transferFrom",
          data: {
            args: [
              eoaAccount.address,
              mcNexus.addressOn(targetChain.id, true),
              runtimeERC20BalanceOf(
                eoaAccount.address,
                mcUSDC,
                targetChain.id,
                [greaterThanOrEqualTo(parseUnits("0.01", 6))]
              )
            ]
          }
        },
        chainId: targetChain.id
      }
    )

    expect(instructions.length).toBeGreaterThan(0)
  })
})
