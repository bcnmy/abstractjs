import { type Url, toClients, toEcosystem } from "ecosystem"
import { http, type Chain, zeroAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { beforeAll, describe, expect, test } from "vitest"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { executeSignedQuote } from "./executeSignedQuote"
import type { FeeTokenInfo, Instruction } from "./getQuote"
import { signQuote } from "./signQuote"

describe("mee.executeSignedQuote", () => {
  const eoaAccount = privateKeyToAccount(`0x${process.env.PRIVATE_KEY!}`)

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient

  let paymentChain: Chain
  let targetChain: Chain

  beforeAll(async () => {
    const ecosystem = await toEcosystem({
      withMee: true,
      chainLength: 2,
      forkUrl:
        "https://base-sepolia.g.alchemy.com/v2/EX-Rh8dvlZU3i-WJlp9gpK17PjzOWRlL"
    })
    const chains = ecosystem.infras.map((infra) => infra.network.chain)
    const rpcs = ecosystem.infras.map((infra) => infra.network.rpcUrl)
    const meeUrl = `${ecosystem.meeNode?.url}/v3` as Url

    paymentChain = chains[0]
    targetChain = chains[1]

    feeToken = {
      address: "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports: rpcs.map((rpc) => http(rpc)),
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus, url: meeUrl })

    const { testClient } = await toClients({
      rpcUrl: rpcs[0],
      chain: paymentChain
    })

    // @ts-ignore
    await testClient.deal({
      erc20: feeToken.address,
      account: mcNexus.addressOn(paymentChain.id),
      amount: 1000000000n
    })

    await testClient.setBalance({
      address: mcNexus.addressOn(paymentChain.id, true),
      value: 1000000000n
    })
  })

  test("should execute a quote using executeSignedQuote", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: zeroAddress,
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      }
    ]

    expect(instructions).toBeDefined()

    const quote = await meeClient.getQuote({
      instructions,
      feeToken
    })

    const signedQuote = await signQuote(meeClient, { quote })

    const { hash } = await executeSignedQuote(meeClient, {
      signedQuote
    })

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({ hash })

    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("MINED_SUCCESS")
  })
})
