import type { Address, Chain } from "viem"

export type AddressMapping = {
  chainId: number
  address: Address
}

export type MultichainAddressMapping = {
  deployments: AddressMapping[]
  on: (chainId: number) => Address
}

export function buildMultichainAddressMapping(
  deployments: AddressMapping[]
): MultichainAddressMapping {
  return {
    deployments: deployments,
    on: (chainId: number) => {
      const deployment = deployments.find((dep) => dep.chainId === chainId)
      if (!deployment) {
        throw Error(
          `No deployment found for address mapping for chainId: ${chainId}`
        )
      }
      return deployment.address
    }
  }
}

export function mapAddressToChain(
  address: Address,
  chainId: number
): AddressMapping {
  return {
    chainId: chainId,
    address: address
  }
}

export function address(address: Address): {
  on: (chain: Chain) => {
    chainId: number
    address: Address
  }
} {
  return {
    on: (chain) => {
      return {
        chainId: chain.id,
        address: address
      }
    }
  }
}
