import {
  http,
  type Account,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  zeroAddress
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import { beforeAll, describe, expect, test } from "vitest"
import {
  NEXUS_IMPLEMENTATION_ADDRESS,
  NexusImplementationAbi
} from "../../../constants"

const rpcUrl = `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`
const eoa = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`)
const httpTransport = http(rpcUrl)

describe("EIP-7702 auth", () => {
  let walletClient: WalletClient<Transport, Chain, Account>
  let publicClient: PublicClient

  beforeAll(async () => {
    console.log("account.address", eoa.address)
    console.log(`https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`)

    // mcNexus = await toMultichainNexusAccount({
    //   accountAddress: account.address,
    //   signer: account,
    //   chains: [sepolia],
    //   transports: [http()],
    // })
    // meeClient = await createMeeClient({ account: mcNexus })
    walletClient = createWalletClient({
      chain: sepolia,
      transport: httpTransport,
      account: eoa
    })
    publicClient = createPublicClient({
      chain: sepolia,
      transport: httpTransport
    })
  })

  test("should undelegate", async () => {
    const isDelegated = await publicClient.getCode({ address: eoa.address })
    console.log({ isDelegated })
    if (isDelegated) {
      const authorization = await walletClient.signAuthorization({
        contractAddress: zeroAddress
      })
      const hash = await walletClient.sendTransaction({
        authorizationList: [authorization],
        value: 0n,
        to: eoa.address
      })
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 3 })
    }
  })

  test("should delegate the account", async () => {
    const isDelegated = await publicClient.getCode({ address: eoa.address })
    if (!isDelegated) {
      const authorization = await walletClient.signAuthorization({
        contractAddress: NEXUS_IMPLEMENTATION_ADDRESS
      })
      const hash = await walletClient.sendTransaction({
        account: eoa,
        data: encodeFunctionData({
          abi: NexusImplementationAbi,
          functionName: "accountId"
        }),
        authorizationList: [authorization],
        to: eoa.address
      })
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 3
      })
      console.log({ receipt })
      expect(receipt.status).toBe("success")
      const delegatedCode = await publicClient.getCode({ address: eoa.address })
      expect(delegatedCode).toBeTruthy()
    }
  })

  // test("should undelegate the account", async () => {
  //   const isDeployed = await mcNexus
  //     .deploymentOn(sepolia.id, true)
  //     .isDeployed()
  //   expect(isDeployed).toBe(true)
  //   if (isDeployed) {
  //     const hash = await mcNexus
  //       .deploymentOn(sepolia.id, true)
  //       .unDelegate()
  //     const receipt = await publicClient.waitForTransactionReceipt({ hash })
  //     expect(receipt.status).toBe("success")
  //     const codeAfter = await publicClient.getCode({
  //       address: mcNexus.addressOn(sepolia.id, true)
  //     })
  //     expect(codeAfter).toBeUndefined()
  //   }
  // })

  // test.skip("should get a MEE quote with eip7702 delegation", async () => {
  //   const isDeployed = await mcNexus
  //     .deploymentOn(sepolia.id, true)
  //     .isDeployed()
  //   expect(isDeployed).toBe(false)
  //   const codeAtAddress = await publicClient.getCode({
  //     address: mcNexus.addressOn(sepolia.id, true)
  //   })
  //   console.log({ codeAtAddress })

  //   const balanceBefore = await publicClient.getBalance({
  //     address: zeroAddress
  //   })
  //   console.log({ balanceBefore })
  //   const quote = await meeClient.getQuote({
  //     delegate: true,
  //     instructions: [
  //       {
  //         calls: [
  //           {
  //             to: zeroAddress,
  //             value: 1n
  //           }
  //         ],
  //         chainId: sepolia.id
  //       }
  //     ],
  //     feeToken: {
  //       address: zeroAddress,
  //       chainId: sepolia.id
  //     }
  //   })

  //   console.log({ quote })

  //   expect(quote).toBeDefined()
  //   const { hash } = await meeClient.executeQuote({ quote })
  //   expect(hash).toBeDefined()

  //   const receipt = await meeClient.waitForSupertransactionReceipt({ hash })
  //   console.log({ receipt })
  //   expect(receipt).toBeDefined()
  //   expect(receipt.transactionStatus).toBe("MINED_SUCCESS")

  //   const balanceAfter = await publicClient.getBalance({ address: zeroAddress })
  //   expect(balanceAfter).toBeGreaterThan(balanceBefore)
  // })
})
