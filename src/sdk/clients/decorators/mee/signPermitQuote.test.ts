import {
  type Chain,
  type Hex,
  type LocalAccount,
  getContract,
  isHex,
  keccak256,
  toBytes,
  zeroAddress
} from "viem"
import { optimism } from "viem/chains"
import { beforeAll, describe, expect, inject, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { toFeeToken } from "../../../account/utils/toFeeToken"
import { PERMIT_TYPEHASH, TokenWithPermitAbi } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import { getPermitQuote } from "./getPermitQuote"
import type { FeeTokenInfo, Instruction } from "./getQuote"
import { signPermitQuote } from "./signPermitQuote"
import waitForSupertransactionReceipt from "./waitForSupertransactionReceipt"

describe("mee.signPermitQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let mcNexus: MultichainSmartAccount
  let feeToken: FeeTokenInfo
  let meeClient: MeeClient

  let targetChain: Chain
  let paymentChain: Chain

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = toFeeToken({ mcToken: mcUSDC, chainId: paymentChain.id })

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should check permitTypehash is correct", async () => {
    const permitTypehash = keccak256(
      toBytes(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
      )
    )
    expect(permitTypehash).toBe(PERMIT_TYPEHASH)
  })

  test("should check domainSeparator is correct", async () => {
    const expectedDomainSeparatorForOptimism =
      "0x26d9c34bb1a1c312f69c53b2d93b8be20faafba63af2438c6811713c9b1f933f"

    const domainSeparator = await getContract({
      address: mcUSDC.addressOn(optimism.id),
      abi: TokenWithPermitAbi,
      client: mcNexus.deploymentOn(optimism.id, true).client
    }).read.DOMAIN_SEPARATOR()

    expect(domainSeparator).toBe(expectedDomainSeparatorForOptimism)
  })

  test("should sign a quote using signPermitQuote", async () => {
    const quote = await getPermitQuote(meeClient, {
      instructions: [
        meeClient.account.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    const signedPermitQuote = await signPermitQuote(meeClient, { quote })

    console.log(JSON.stringify(signedPermitQuote, null, 2))
  })

  test("should execute a signed permit quote", async () => {
    console.time("permitQuote:getQuote")
    console.time("permitQuote:getHash")
    console.time("permitQuote:receipt")
    const quote = await getPermitQuote(meeClient, {
      instructions: [
        meeClient.account.build({
          type: "default",
          data: {
            calls: [
              {
                to: zeroAddress,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    console.timeEnd("permitQuote:getQuote")
    const signedPermitQuote = await signPermitQuote(meeClient, { quote })

    const { hash } = await executeSignedQuote(meeClient, {
      signedQuote: signedPermitQuote
    })
    console.timeEnd("permitQuote:getHash")
    const receipt = await waitForSupertransactionReceipt(meeClient, {
      hash
    })
    console.timeEnd("permitQuote:receipt")
    expect(receipt).toBeDefined()
    console.log(receipt.explorerLinks)
  })
})
