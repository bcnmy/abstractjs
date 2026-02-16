import {
  type Address,
  type Hex,
  encodeFunctionData,
  encodePacked,
  parseAbi
} from "viem"
import { readContract } from "viem/actions"
import type { BaseMultichainSmartAccount } from ".."
import type { Instruction } from "../../clients/decorators/mee/getQuote"
import type { ModularSmartAccount } from "../../modules/utils/Types"
import type { MEEVersionConfig } from "../utils/getVersion"
import type { Signer } from "../utils/toSigner"

const stxValidatorAbi = parseAbi([
  "function setOwnershipData(address statelessValidatorAddress, bytes ownershipData)",
  "function cleanOwnershipData(address statelessValidatorAddress)",
  "function getOwnershipData(address smartAccount, address statelessValidatorAddress) view returns (bytes)"
])

export type OwnershipType = "eoa" | "p256" | "safe" | Address

export type OwnershipParams = {
  ownershipType: OwnershipType
  chainIds?: number[]
}

export type OwnershipParamsWithData = {
  coreOwnershipParams: OwnershipParams
  ownershipData?: Hex
}

export type OwnershipResult = {
  chainId: number
  data: Hex
}

function filterDeployments(
  deployments: ModularSmartAccount[],
  chainIds?: number[]
): ModularSmartAccount[] {
  if (!chainIds || chainIds.length === 0) return deployments

  const deployedChainIds = new Set(
    deployments.map((d) => d.client.chain?.id).filter(Boolean)
  )
  const missing = chainIds.filter((id) => !deployedChainIds.has(id))
  if (missing.length > 0) {
    throw new Error(
      `No deployments found for chainIds: ${missing.join(", ")}. Available chainIds: ${[...deployedChainIds].join(", ")}`
    )
  }

  return deployments.filter((d) => {
    const id = d.client.chain?.id
    return id !== undefined && chainIds.includes(id)
  })
}

function resolveStatelessValidator(
  ownershipType: OwnershipType,
  submodules: MEEVersionConfig["submodules"]
): Address {
  if (
    ownershipType !== "eoa" &&
    ownershipType !== "p256" &&
    ownershipType !== "safe"
  ) {
    return ownershipType as Address
  }

  const mapping: Record<string, Address | undefined> = {
    eoa: submodules?.EoaStatelessValidator,
    p256: submodules?.P256StatelessValidator,
    safe: submodules?.SafeAccountSubmodule
  }

  const address = mapping[ownershipType]
  if (!address) {
    throw new Error(
      `Stateless validator address for "${ownershipType}" not found in submodules. Ensure MEE version V3_0_0+ is configured.`
    )
  }
  return address
}

function deriveOwnershipData(
  signer: Signer,
  ownershipType: OwnershipType,
  ownershipDataOverride?: Hex
): Hex {
  if (ownershipDataOverride) {
    return ownershipDataOverride
  }

  if (ownershipType === "p256") {
    if (!signer.publicKey) {
      throw new Error(
        "P256 signer must have a publicKey to derive ownership data"
      )
    }
    const x = `0x${signer.publicKey.slice(4, 68)}` as Hex
    const y = `0x${signer.publicKey.slice(68, 132)}` as Hex
    return encodePacked(["bytes32", "bytes32"], [x, y])
  }

  if (ownershipType === "eoa" || ownershipType === "safe") {
    return encodePacked(["address"], [signer.address])
  }

  // Custom validator address — ownershipData must be provided
  throw new Error(
    "ownershipData must be provided when using a custom stateless validator address"
  )
}

export function addOwnership(
  account: BaseMultichainSmartAccount,
  params: OwnershipParamsWithData
): Instruction[] {
  const { coreOwnershipParams, ownershipData: ownershipDataOverride } = params
  const { ownershipType, chainIds } = coreOwnershipParams
  const deployments = filterDeployments(account.deployments, chainIds)

  return deployments.map((deployment) => {
    const chainId = deployment.client.chain?.id
    if (!chainId) throw new Error("Chain ID is not set")

    const statelessValidator = resolveStatelessValidator(
      ownershipType,
      deployment.version.submodules
    )

    const ownershipData = deriveOwnershipData(
      account.signer,
      ownershipType,
      ownershipDataOverride
    )

    const data = encodeFunctionData({
      abi: stxValidatorAbi,
      functionName: "setOwnershipData",
      args: [statelessValidator, ownershipData]
    })

    return {
      calls: [{ to: deployment.version.validatorAddress, data }],
      chainId
    }
  })
}

export async function changeOwnership(
  account: BaseMultichainSmartAccount,
  params: OwnershipParamsWithData
): Promise<Instruction[]> {
  const { coreOwnershipParams, ownershipData: ownershipDataOverride } = params
  const { ownershipType, chainIds } = coreOwnershipParams
  const deployments = filterDeployments(account.deployments, chainIds)

  const instructions = await Promise.all(
    deployments.map(async (deployment) => {
      const chainId = deployment.client.chain?.id
      if (!chainId) throw new Error("Chain ID is not set")

      const statelessValidator = resolveStatelessValidator(
        ownershipType,
        deployment.version.submodules
      )

      const existing = await readContract(deployment.client, {
        address: deployment.version.validatorAddress,
        abi: stxValidatorAbi,
        functionName: "getOwnershipData",
        args: [deployment.address, statelessValidator]
      })

      if (!existing || existing === "0x" || existing === "0x0") {
        throw new Error(
          `No ownership data found on chain ${chainId} for ownership type "${ownershipType}". Use addOwnership instead.`
        )
      }

      const ownershipData = deriveOwnershipData(
        account.signer,
        ownershipType,
        ownershipDataOverride
      )

      const data = encodeFunctionData({
        abi: stxValidatorAbi,
        functionName: "setOwnershipData",
        args: [statelessValidator, ownershipData]
      })

      return {
        calls: [{ to: deployment.version.validatorAddress, data }],
        chainId
      }
    })
  )

  return instructions
}

export function cleanOwnership(
  account: BaseMultichainSmartAccount,
  params: OwnershipParams
): Instruction[] {
  const { ownershipType, chainIds } = params
  const deployments = filterDeployments(account.deployments, chainIds)

  return deployments.map((deployment) => {
    const chainId = deployment.client.chain?.id
    if (!chainId) throw new Error("Chain ID is not set")

    const statelessValidator = resolveStatelessValidator(
      ownershipType,
      deployment.version.submodules
    )

    const data = encodeFunctionData({
      abi: stxValidatorAbi,
      functionName: "cleanOwnershipData",
      args: [statelessValidator]
    })

    return {
      calls: [{ to: deployment.version.validatorAddress, data }],
      chainId
    }
  })
}

export async function getOwnership(
  account: BaseMultichainSmartAccount,
  params: OwnershipParams
): Promise<OwnershipResult[]> {
  const { ownershipType, chainIds } = params
  const deployments = filterDeployments(account.deployments, chainIds)

  const results = await Promise.all(
    deployments.map(async (deployment) => {
      const chainId = deployment.client.chain?.id
      if (!chainId) throw new Error("Chain ID is not set")

      const statelessValidator = resolveStatelessValidator(
        ownershipType,
        deployment.version.submodules
      )

      const data = await readContract(deployment.client, {
        address: deployment.version.validatorAddress,
        abi: stxValidatorAbi,
        functionName: "getOwnershipData",
        args: [deployment.address, statelessValidator]
      })

      return { chainId, data: data as Hex }
    })
  )

  return results
}
