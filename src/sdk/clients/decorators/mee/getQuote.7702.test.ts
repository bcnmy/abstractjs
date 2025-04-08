import {
  http,
  type Chain,
  type LocalAccount,
  type Transport,
  zeroAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { type MeeClient, createMeeClient } from "../../createMeeClient"

const sepoliaChain: Chain = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: ["https://0xrpc.io/sep"]
    }
  }
}

describe("EIP-7702 auth", () => {
  const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`)

  let mcAccount: MultichainSmartAccount
  let meeClient: MeeClient

  beforeAll(async () => {
    mcAccount = await toMultichainNexusAccount({
      accountAddress: account.address,
      signer: account,
      chains: [sepoliaChain],
      transports: [http()],
      index: 100n
    })

    meeClient = await createMeeClient({ account: mcAccount })
  })

  test("should get a MEE quote with eip7702 delegation", async () => {
    const quote = await meeClient.getQuote({
      delegate: true,
      instructions: [
        {
          calls: [
            {
              to: zeroAddress,
              value: 1n
            }
          ],
          chainId: sepoliaChain.id
        }
      ],
      feeToken: {
        address: zeroAddress,
        chainId: sepoliaChain.id
      }
    })

    expect(quote).toBeDefined()
    const { hash } = await meeClient.executeQuote({ quote })
    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
    console.log("receipt:", receipt)
    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("SUCCESS")
  })
})
