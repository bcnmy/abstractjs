import {
  http,
  type Chain,
  type PublicClient,
  createPublicClient,
  zeroAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  type MultichainSmartAccount,
  toMultichainNexusAccount
} from "../../../account/toMultiChainNexusAccount"
import { getRandomBigInt } from "../../../account/utils/Helpers"
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
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let publicClient: PublicClient

  const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`)

  beforeAll(async () => {
    const index = getRandomBigInt()

    console.log("account.address", account.address)

    mcNexus = await toMultichainNexusAccount({
      accountAddress: account.address,
      signer: account,
      chains: [sepoliaChain],
      transports: [http()],
      index
    })
    meeClient = await createMeeClient({ account: mcNexus })
    publicClient = createPublicClient({
      chain: sepoliaChain,
      transport: http()
    })
  })

  test("should undelegate the account", async () => {
    const isDeployed = await mcNexus
      .deploymentOn(sepoliaChain.id, true)
      .isDeployed()
    expect(isDeployed).toBe(true)
    if (isDeployed) {
      const hash = await mcNexus
        .deploymentOn(sepoliaChain.id, true)
        .unDelegate()
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      expect(receipt.status).toBe("success")
      const codeAtAddress = await publicClient.getCode({
        address: mcNexus.addressOn(sepoliaChain.id, true)
      })
      expect(codeAtAddress).toBeUndefined()
    }
  })

  test.skip("should get a MEE quote with eip7702 delegation", async () => {
    const isDeployed = await mcNexus
      .deploymentOn(sepoliaChain.id, true)
      .isDeployed()
    expect(isDeployed).toBe(false)
    const codeAtAddress = await publicClient.getCode({
      address: mcNexus.addressOn(sepoliaChain.id, true)
    })
    console.log({ codeAtAddress })

    const balanceBefore = await publicClient.getBalance({
      address: zeroAddress
    })
    console.log({ balanceBefore })
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

    console.log({ quote })

    expect(quote).toBeDefined()
    const { hash } = await meeClient.executeQuote({ quote })
    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
    console.log({ receipt })
    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

    const balanceAfter = await publicClient.getBalance({ address: zeroAddress })
    expect(balanceAfter).toBeGreaterThan(balanceBefore)
  })
})
