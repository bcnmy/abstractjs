import { erc20Abi, getContract } from "viem"
import type { MultichainSmartAccount } from "../../account-vendors/account"
import type {
  AddressMapping,
  MultichainAddressMapping
} from "../../primitives/address-mapping"
import type { MultichainContract } from "./getMultichainContract"

export type UnifiedBalanceItem = {
  balance: bigint
  decimals: number
}

export type UnifiedERC20Balance = {
  token: MultichainContract<typeof erc20Abi>
  breakdown: Array<UnifiedBalanceItem & { chainId: number }>
} & UnifiedBalanceItem

export async function getUnifiedERC20Balance(parameters: {
  multichainERC20: MultichainContract<typeof erc20Abi>
  multichainAccount: MultichainSmartAccount
}): Promise<UnifiedERC20Balance> {
  const { multichainERC20, multichainAccount } = parameters

  const balances = await Promise.all(
    Array.from(multichainERC20.deployments).map(async (token) => {
      const [chainId, address] = token
      const account = multichainAccount.deploymentOn(chainId)
      if (!account) {
        throw Error(`
        Error while fetching a Unified ERC20 Balance for token ${address}.
        Account not initialized for chainId: ${chainId}.
      `)
      }
      const tokenContract = getContract({
        abi: erc20Abi,
        address: address,
        client: account.client
      })

      const [balance, decimals] = await Promise.all([
        tokenContract.read.balanceOf([account.address]),
        tokenContract.read.decimals()
      ])

      return {
        balance: balance,
        decimals: decimals,
        chainId: chainId
      }
    })
  )

  return {
    ...balances
      .map((balance) => {
        return {
          balance: balance.balance,
          decimals: balance.decimals
        }
      })
      .reduce((curr, acc) => {
        if (curr.decimals !== acc.decimals) {
          throw Error(`
          Error while trying to fetch a unified ERC20 balance. The addresses provided
          in the mapping don't have the same number of decimals across all chains. 
          The function can't fetch a unified balance for token mappings with differing 
          decimals.
        `)
        }
        return {
          balance: curr.balance + acc.balance,
          decimals: curr.decimals
        }
      }),
    breakdown: balances,
    token: multichainERC20
  }
}
