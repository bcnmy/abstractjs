import { http, type Chain, type LocalAccount, zeroAddress } from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import { toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MeeClient,
  createMeeClient
} from "../../../clients/createMeeClient"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { getMEEVersion, runtimeNativeBalanceOf } from "../../../modules"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../toMultiChainNexusAccount"

describe("mee.buildNativeTokenTransfer", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain

  beforeAll(async () => {
    network = await toNetwork("TESTNET_FROM_ENV_VARS")
    eoaAccount = network.account!
    chain = network.chain

    mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(DEFAULT_MEE_VERSION)
        }
      ]
    })

    meeClient = await createMeeClient({
      account: mcNexus
    })
  })

  test("Execute nativeTokenTransfer instruction without composability", async () => {
    const instructions = await mcNexus.build({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        chainId: chain.id,
        value: 1n
      }
    })

    const quote = await meeClient.getQuote({
      instructions,
      feeToken: {
        address: zeroAddress,
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote: quote })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: 5
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Execute nativeTokenTransfer instruction with composability", async () => {
    const instructions = await mcNexus.buildComposable({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        chainId: chain.id,
        value: 1n
      }
    })

    const quote = await meeClient.getQuote({
      instructions,
      feeToken: {
        address: zeroAddress,
        chainId: chain.id
      }
    })

    expect(quote).toBeDefined()

    const { hash } = await meeClient.executeQuote({ quote: quote })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash,
      confirmations: 5
    })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })

  test("Using native runtime injection with composability v1 should fail", async () => {
    await expect(
      mcNexus.buildComposable({
        type: "nativeTokenTransfer",
        data: {
          to: eoaAccount.address,
          chainId: chain.id,
          value: runtimeNativeBalanceOf({
            targetAddress: mcNexus.addressOn(chain.id, true)
          })
        }
      })
    ).rejects.toThrowError(
      "Runtime values for Native tokens are not supported for Composability v1.0.0"
    )
  })

  test("Using native runtime injection with composability v2 should work", async () => {
    const mcNexus = await toMultichainNexusAccount({
      signer: eoaAccount,
      chainConfigurations: [
        {
          chain: chain,
          transport: http(network.rpcUrl),
          version: getMEEVersion(MEEVersion.V2_2_0)
        }
      ]
    })

    const instruction = await mcNexus.buildComposable({
      type: "nativeTokenTransfer",
      data: {
        to: eoaAccount.address,
        chainId: chain.id,
        value: runtimeNativeBalanceOf({
          targetAddress: mcNexus.addressOn(chain.id, true)
        })
      }
    })

    expect(instruction).toBeDefined()
  })
})
