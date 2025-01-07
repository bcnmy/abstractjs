import type { Signer } from "@biconomy/sdk"
import { http, type Chain } from "viem"
import { MultichainSmartAccount } from "../account"
import { toMeeCompliantNexusAccount } from "./nexus-mee-compliant"

export type MeeNexusParams = {
  signer: Signer
  chains: Chain[]
}

export async function toMultichainNexusAccount(
  parameters: MeeNexusParams
): Promise<MultichainSmartAccount> {
  const { signer, chains } = parameters

  const accounts = await Promise.all(
    chains.map((chain) =>
      toMeeCompliantNexusAccount({ chain, signer, transport: http() })
    )
  )

  return new MultichainSmartAccount(accounts, signer)
}
