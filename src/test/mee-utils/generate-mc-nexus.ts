import {
  http,
  type Account,
  type Address,
  type Chain,
  type LocalAccount,
  type OneOf,
  type PublicClient,
  type Transport,
  type WalletClient,
  parseUnits
} from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { toMultichainNexusAccount } from "../../sdk/account"
import {
  createMeeClient,
  getDefaultMEENetworkApiKey
} from "../../sdk/clients/createMeeClient"
import { DEFAULT_MEE_VERSION } from "../../sdk/constants"
import { getMEEVersion } from "../../sdk/modules"
import { TESTNET_RPC_URLS } from "../testSetup"
import { testnetMcTestUSDC, testnetMcTestUSDCP } from "../testTokens"
import { getRandomAccountIndex, transferErc20 } from "../testUtils"

export const generateNewTestnetMcNexusAccountAndMeeClient = async (
  paymentChain: Chain,
  targetChain: Chain,
  paymentChainPublicClient: PublicClient,
  paymentChainWalletClient: WalletClient<Transport, Chain, Account>,
  eoaAccount: LocalAccount,
  options?: {
    amount?: bigint
    tokenType?: "onchain" | "permit"
    newType?: "fresh-pk" | "fresh-index"
    walletMode?: "EOA" | "7702"
  } & OneOf<
    | { fundEoa: boolean }
    | { fundMcNexus: boolean }
    | { fundCustomAddress: boolean; accountAddress: Address }
    | { sponsorship: boolean }
  >
) => {
  const account =
    options?.newType === "fresh-index"
      ? eoaAccount
      : privateKeyToAccount(generatePrivateKey())

  const mcNexus = await toMultichainNexusAccount({
    signer: account,
    chainConfigurations: [
      {
        chain: paymentChain,
        transport: http(TESTNET_RPC_URLS[paymentChain.id]),
        version: getMEEVersion(DEFAULT_MEE_VERSION),
        ...(options?.walletMode === "7702"
          ? { accountAddress: account.address }
          : {})
      },
      {
        chain: targetChain,
        transport: http(TESTNET_RPC_URLS[targetChain.id]),
        version: getMEEVersion(DEFAULT_MEE_VERSION),
        ...(options?.walletMode === "7702"
          ? { accountAddress: account.address }
          : {})
      }
    ],
    ...(options?.newType === "fresh-index"
      ? { index: BigInt(getRandomAccountIndex(1000, 1000000000)) }
      : {})
  })

  const meeClient = await createMeeClient({
    account: mcNexus,
    apiKey: options?.sponsorship
      ? "mee_3Zmc7H6Pbd5wUfUGu27aGzdf"
      : getDefaultMEENetworkApiKey(true)
  })

  let fundingAddress: Address | undefined = undefined

  if (options?.fundEoa) {
    fundingAddress = account.address
  }

  if (options?.fundMcNexus) {
    fundingAddress = mcNexus.addressOn(paymentChain.id, true)
  }

  if (options?.fundCustomAddress && options?.accountAddress) {
    fundingAddress = options.accountAddress
  }

  if (fundingAddress) {
    await transferErc20({
      publicClient: paymentChainPublicClient,
      walletClient: paymentChainWalletClient,
      tokenAddress:
        options?.tokenType === "onchain"
          ? testnetMcTestUSDC.addressOn(paymentChain.id)
          : testnetMcTestUSDCP.addressOn(paymentChain.id),
      recipient: fundingAddress,
      amount: options?.amount || parseUnits("0.6", 6)
    })
  }

  return { mcNexus, meeClient, eoaAccount: account }
}
