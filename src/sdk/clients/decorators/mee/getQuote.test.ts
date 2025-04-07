import {
  type Chain,
  type Hex,
  type LocalAccount,
  type Transport,
  createWalletClient
} from "viem"
import { sepolia } from "viem/chains"
import { eip7702Actions } from "viem/experimental"
import { beforeAll, describe, expect, test } from "vitest"
import { getTestChainConfig, toNetwork } from "../../../../test/testSetup"
import type { NetworkConfig } from "../../../../test/testUtils"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { toMultichainNexusAccount } from "../../../account/toMultiChainNexusAccount"
import { mcUSDC } from "../../../constants/tokens"
import { type MeeClient, createMeeClient } from "../../createMeeClient"
import { type FeeTokenInfo, type Instruction, getQuote } from "./getQuote"

describe("EIP-7702 auth", () => {
  const account = privateKeyToAccount(privateKey as Hex)

  console.log("EOA:", account.address)

  let mcAccount: MultichainSmartAccount
  let meeClient: MeeClient
  beforeAll(async () => {
    mcAccount = await toMultichainNexusAccount({
      signer: account,
      chains: [sepolia],
      transports: [http()],
      validatorAddress: "0xB4Db35b48d6fDD1bFAD19dE34CFa6F9e45a88C1E",
      account: account.address,
      factoryAddress: "0xBD6cECf5bA9bFe4fE134451cC5457cd58B18D1f2",
      bootStrapAddress: "0xf80D7D5d14B029E97A5055bAc350fAb2e25f655E"
    })

    meeClient = await createMeeClient({
      account: mcAccount,
      url: "http://localhost:8888"
    })
  })

  test("should get a MEE quote with eip7702Auth", async () => {
    console.log("mcAccount:", mcAccount.addressOn(sepolia.id))

    const walletClient = createWalletClient({
      chain: sepolia,
      account,
      transport: http()
    }).extend(eip7702Actions())

    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http()
    })

    const nonce = await publicClient.getTransactionCount({
      address: account.address
    })

    console.log("nonce:", nonce)

    const authorization = await walletClient.signAuthorization({
      account,
      contractAddress: "0x7170Cd8Ab389fAEc37972bCF3dBB17d37ba5D2f7",
      nonce
    })

    console.log("authorization:", authorization)

    const eip7702Auth = {
      chainId: `0x${sepolia.id.toString(16)}` as Hex,
      address: "0x7170Cd8Ab389fAEc37972bCF3dBB17d37ba5D2f7" as Hex,
      nonce: `0x${authorization.nonce.toString(16)}` as Hex,
      r: authorization.r as Hex,
      s: authorization.s as Hex,
      v: `0x${authorization.v!.toString(16)}` as Hex,
      yParity: `0x${authorization.yParity!.toString(16)}` as Hex
    }
    console.log("request authorization:", eip7702Auth)

    const quote = await meeClient.getQuote({
      instructions: [
        {
          calls: [
            {
              to: zeroAddress,
              value: BigInt(1),
              gasLimit: BigInt(100000)
            }
          ],
          chainId: sepolia.id,
          eip7702Auth
        }
      ],
      feeToken: {
        address: zeroAddress,
        chainId: sepolia.id,
        eip7702Auth
      }
    })

    expect(quote).toBeDefined()
    console.log("quote:", quote)

    const { hash } = await meeClient.executeQuote({ quote })

    console.log("hash:", hash)

    expect(hash).toBeDefined()

    const receipt = await meeClient.waitForSupertransactionReceipt({
      hash
    })
    console.log("receipt:", receipt)
    expect(receipt).toBeDefined()
    expect(receipt.transactionStatus).toBe("SUCCESS")
  })
})

describe("mee.getQuote", () => {
  let network: NetworkConfig
  let eoaAccount: LocalAccount

  let feeToken: FeeTokenInfo
  let mcNexus: MultichainSmartAccount
  let meeClient: MeeClient
  let paymentChain: Chain
  let targetChain: Chain
  let transports: Transport[]

  beforeAll(async () => {
    network = await toNetwork("MAINNET_FROM_ENV_VARS")
    ;[[paymentChain, targetChain], transports] = getTestChainConfig(network)

    eoaAccount = network.account!
    feeToken = {
      address: mcUSDC.addressOn(paymentChain.id),
      chainId: paymentChain.id
    }

    mcNexus = await toMultichainNexusAccount({
      chains: [paymentChain, targetChain],
      transports,
      signer: eoaAccount
    })

    meeClient = await createMeeClient({ account: mcNexus })
  })

  test("should resolve instructions", async () => {
    const instructions: Instruction[] = [
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      },
      {
        calls: [
          {
            to: "0x0000000000000000000000000000000000000000",
            gasLimit: 50000n,
            value: 0n
          }
        ],
        chainId: targetChain.id
      }
    ]

    expect(instructions).toBeDefined()
    expect(instructions.length).toEqual(2)

    const quote = await getQuote(meeClient, { instructions, feeToken })

    expect(quote).toBeDefined()
  })

  test("should resolve unresolved instructions", async () => {
    const quote = await getQuote(meeClient, {
      instructions: [
        mcNexus.build({
          type: "intent",
          data: {
            amount: 1n,
            mcToken: mcUSDC,
            toChain: targetChain
          }
        }),
        mcNexus.build({
          type: "default",
          data: {
            calls: [
              {
                to: "0x0000000000000000000000000000000000000000",
                gasLimit: 50000n,
                value: 0n
              }
            ],
            chainId: targetChain.id
          }
        })
      ],
      feeToken
    })

    expect([2, 3].includes(quote.userOps.length)).toBe(true) // 2 or 3 depending on if bridging is needed
  })
})
