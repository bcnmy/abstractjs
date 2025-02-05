import {
  type Address,
  type Chain,
  type LocalAccount,
  getContract,
  keccak256,
  toBytes,
  zeroAddress
} from "viem"
import { optimism } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChains, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { PERMIT_TYPEHASH, TokenWithPermitAbi } from "../../../constants"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import getFusionQuote from "./getFusionQuote"
import type { FeeTokenInfo } from "./getQuote"
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
  let tokenAddress: Address

  const index = 89n // Randomly chosen index

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[paymentChain, targetChain] = getTestChains(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      signer: eoaAccount,
      index
    })

    meeClient = await createMeeClient({ account: mcNexus })
    tokenAddress = mcUSDC.addressOn(paymentChain.id)
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
    const fusionQuote = await getFusionQuote(meeClient, {
      trigger: {
        chainId: paymentChain.id,
        tokenAddress,
        amount: 1n
      },
      instructions: [
        mcNexus.build({
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

    const signedPermitQuote = await signPermitQuote(meeClient, { fusionQuote })
    expect(signedPermitQuote).toBeDefined()
  })

  test(
    "should execute a signed fusion quote using signPermitQuote",
    async () => {
      console.time("signPermitQuote:getQuote")
      console.time("signPermitQuote:getHash")
      console.time("signPermitQuote:receipt")

      const fusionQuote = await getFusionQuote(meeClient, {
        trigger: {
          chainId: paymentChain.id,
          tokenAddress,
          amount: 1n
        },
        instructions: [
          mcNexus.build({
            type: "transfer",
            data: {
              chainId: paymentChain.id,
              tokenAddress,
              amount: 1n,
              recipient: eoaAccount.address
            }
          })
        ],
        feeToken
      })

      console.timeEnd("signPermitQuote:getQuote")
      const signedQuote = await signPermitQuote(meeClient, { fusionQuote })
      const { hash } = await executeSignedQuote(meeClient, { signedQuote })
      console.timeEnd("signPermitQuote:getHash")
      const receipt = await waitForSupertransactionReceipt(meeClient, { hash })
      console.timeEnd("signPermitQuote:receipt")
      expect(receipt).toBeDefined()
      console.log(receipt.explorerLinks)
    },
    { timeout: 200000 }
  )
})
