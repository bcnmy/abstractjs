import {
  type Account,
  type Chain,
  createPublicClient,
  createTestClient,
  type Hash,
  type Hex,
  http,
  isHex,
  type LocalAccount,
  parseAbi,
  parseEther,
  parseUnits,
  publicActions,
  type PublicClient,
  walletActions
} from "viem"
import {
  getChain,
  getCustomChain,
  type NexusAccount,
  type AnyData
} from "@biconomy/sdk"
import { config } from "dotenv"
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts"
import { anvil as anvilChain } from "viem/chains"
import { mcUSDC } from "../src/commons/tokens/stablecoins"
import { toMeeCompliantNexusAccount } from "../src/account-vendors/nexus/nexus-mee-compliant"
import { anvil } from "prool/instances"
import getPort from "get-port"
import { expect } from "vitest"
import { dealActions } from "viem-deal"
config()

export const getBalance = (
  publicClient: AnyData,
  owner: Hex,
  tokenAddress?: Hex
): Promise<bigint> => {
  if (!tokenAddress) {
    return publicClient.getBalance({ address: owner })
  }
  return publicClient.readContract({
    address: tokenAddress,
    abi: parseAbi([
      "function balanceOf(address owner) public view returns (uint256 balance)"
    ]),
    functionName: "balanceOf",
    args: [owner]
  }) as Promise<bigint>
}

export const getTestAccount = (
  addressIndex = 0
): ReturnType<typeof mnemonicToAccount> => {
  return mnemonicToAccount(
    "test test test test test test test test test test test junk",
    {
      addressIndex
    }
  )
}

export type NetworkConfig = {
  eoa: LocalAccount
  paymentChain: Chain
  paymentToken: Hex
  publicClient: PublicClient
  nexusAccount: NexusAccount
}

type NetworkType = "NETWORK_FROM_ENV" | "ANVIL"

export const initNetwork = async (
  networkType: NetworkType
): Promise<NetworkConfig> => {
  let eoa: LocalAccount
  let paymentChain: Chain
  let paymentToken: Hex
  let publicClient: AnyData
  let nexusAccount: NexusAccount

  switch (networkType) {
    case "NETWORK_FROM_ENV": {
      const paymentChainId = Number(process.env.CHAIN_ID ?? 0)
      expect(paymentChainId).toBeGreaterThan(0)

      paymentChain = getChain(paymentChainId)
      expect(paymentChain).toBeDefined()
      paymentToken = mcUSDC.addressOn(paymentChain.id)

      const PRIV_KEY = process.env.TEST_PRIVATE_KEY as Hash
      if (!isHex(PRIV_KEY)) {
        throw new Error("TEST_PRIVATE_KEY is not a valid hex string")
      }

      eoa = privateKeyToAccount(PRIV_KEY)

      nexusAccount = await toMeeCompliantNexusAccount({
        chain: paymentChain,
        signer: eoa,
        transport: http()
      })

      publicClient = createPublicClient({
        chain: paymentChain,
        transport: http()
      })
      break
    }
    case "ANVIL": {
      const instance = anvil({
        hardfork: "Cancun",
        codeSizeLimit: 1000000000000,
        forkUrl:
          "https://virtual.base-sepolia.rpc.tenderly.co/6ccdd33d-d8f4-4476-8d37-63ba0ed0ea8f"
      })
      await instance.start()

      paymentChain = anvilChain
      paymentToken = mcUSDC.addressOn(paymentChain.id)
      eoa = getTestAccount()

      nexusAccount = await toMeeCompliantNexusAccount({
        chain: paymentChain,
        signer: eoa,
        transport: http()
      })

      publicClient = createTestClient({
        mode: "anvil",
        chain: paymentChain,
        account: eoa,
        transport: http()
      })
        .extend(publicActions)
        .extend(walletActions)
        .extend(dealActions)

      await Promise.all([
        publicClient.setBalance({
          address: nexusAccount.address,
          value: parseEther("1000")
        }),
        publicClient.deal({
          erc20: paymentToken,
          account: nexusAccount.address,
          amount: parseUnits("1000", 6)
        })
      ])
      break
    }
    default: {
      throw new Error("Invalid network type")
    }
  }

  const [eoaBalance, eoaTokenBalance, nexusBalance, nexusTokenBalance] =
    await Promise.all([
      getBalance(publicClient, eoa.address),
      getBalance(publicClient, eoa.address, paymentToken),
      getBalance(publicClient, nexusAccount.address),
      getBalance(publicClient, nexusAccount.address, paymentToken)
    ])

  if (eoaBalance === 0n) {
    throw new Error(
      `Native balance of eoa: ${eoa.address} on ${paymentChain.name} is 0`
    )
  }

  if (eoaTokenBalance === 0n) {
    throw new Error(
      `Token balance ${paymentToken} of eoa: ${eoa.address} on ${paymentChain.name} is 0`
    )
  }

  if (nexusBalance === 0n) {
    throw new Error(
      `Native balance of nexus: ${nexusAccount.address} on ${paymentChain.name} is 0`
    )
  }

  if (nexusTokenBalance === 0n) {
    throw new Error(
      `Token balance ${paymentToken} of nexus: ${nexusAccount.address} on ${paymentChain.name} is 0`
    )
  }

  return {
    eoa,
    paymentChain,
    paymentToken,
    publicClient,
    nexusAccount
  }
}
