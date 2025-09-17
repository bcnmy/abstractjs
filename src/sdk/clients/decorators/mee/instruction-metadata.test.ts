import {
  http,
  type Chain,
  type LocalAccount,
  type WalletClient,
  createWalletClient
} from "viem"
import { beforeAll, describe, expect, test } from "vitest"
import type { Instruction } from "."
import { type NetworkConfig, toNetwork } from "../../../../test/testSetup"
import { testnetMcTestUSDCP } from "../../../../test/testTokens"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { DEFAULT_MEE_VERSION, MEEVersion } from "../../../constants"
import { type AnyData, getMEEVersion } from "../../../modules"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import type {
  InstructionMetadata,
  InstructionMetadataType
} from "./types/instruction-metadata.type"

type TypeToFieldsMap = {
  [K in InstructionMetadata["type"]]: (keyof Extract<
    InstructionMetadata,
    { type: K }
  >)[]
}

const typeToRequiredFields: TypeToFieldsMap = {
  TRANSFER: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  APPROVE: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  WITHDRAW: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  BRIDGE: [
    "type",
    "fromAddress",
    "toAddress",
    "fromTokenAddress",
    "toTokenAddress",
    "fromChainId",
    "toChainId",
    "amount"
  ],
  SWAP: [
    "type",
    "fromTokenAddress",
    "toTokenAddress",
    "fromAddress",
    "toAddress",
    "chainId"
  ],
  ADD_LIQUIDITY: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  REMOVE_LIQUIDITY: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  STAKE: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  UNSTAKE: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  LEND: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  BORROW: [
    "type",
    "tokenAddress",
    "fromAddress",
    "toAddress",
    "amount",
    "chainId"
  ],
  CUSTOM: ["type", "description", "chainId"]
}

const expectValidInstructionMetadata = (obj: unknown) => {
  const array = Array.isArray(obj) ? obj : [obj]

  for (const item of array) {
    expect(item).to.be.an("object").and.to.have.property("type")

    const metadata = item as {
      type: InstructionMetadata["type"]
      [key: string]: AnyData
    }
    const type = metadata.type

    expect(typeToRequiredFields).to.have.property(type)

    const requiredFields = typeToRequiredFields[type]
    for (const field of requiredFields) {
      expect(metadata).to.have.property(field)
    }
  }
}

const validateMetadata = async (
  meeClient: MeeClient,
  chainId: number,
  instructions: Instruction[],
  metadataType: InstructionMetadataType
) => {
  const quote = await meeClient.getQuote({
    instructions: [...instructions],
    feeToken: {
      address: testnetMcTestUSDCP.addressOn(chainId),
      chainId: chainId
    }
  })

  expect(quote).toBeDefined()
  expect(quote.userOps[1].metadata).to.have.length.greaterThanOrEqual(1)
  expect(quote.userOps[1].metadata?.[0].type).to.eq(metadataType)

  expect(() =>
    expectValidInstructionMetadata(quote.userOps[1].metadata || [])
  ).to.not.throw()
}

describe("Instruction metadata test", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let chain: Chain
  let walletClient: WalletClient

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
      account: mcNexus,
      url: "http://localhost:4001/v1"
    })

    walletClient = createWalletClient({
      account: eoaAccount,
      chain,
      transport: http(network.rpcUrl)
    })
  })

  test("ERC20 Transfer instruction metadata test", async () => {
    const transfer = await mcNexus.build({
      type: "transfer",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(meeClient, chain.id, transfer, "TRANSFER")
  })

  test("ERC20 Approve instruction metadata test", async () => {
    const approve = await mcNexus.buildComposable({
      type: "approve",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 1n,
        chainId: chain.id,
        spender: eoaAccount.address
      }
    })

    await validateMetadata(meeClient, chain.id, approve, "APPROVE")
  })

  test("ERC20 transferFrom instruction metadata test", async () => {
    const transferFrom = await mcNexus.buildComposable({
      type: "transferFrom",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 2n,
        chainId: chain.id,
        sender: eoaAccount.address,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(meeClient, chain.id, transferFrom, "TRANSFER")
  })

  test("withdraw instruction metadata test", async () => {
    const withdraw = await mcNexus.buildComposable({
      type: "withdrawal",
      data: {
        tokenAddress: testnetMcTestUSDCP.addressOn(chain.id),
        amount: 3n,
        chainId: chain.id,
        recipient: eoaAccount.address
      }
    })

    await validateMetadata(meeClient, chain.id, withdraw, "WITHDRAW")
  })
})
