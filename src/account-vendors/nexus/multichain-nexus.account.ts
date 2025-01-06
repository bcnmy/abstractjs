import type { Signer } from "@biconomy/sdk"
import { http, type Chain, type Transport } from "viem"
import type { NonEmptyArray } from "../../utils/types/util.type"
import { MultichainSmartAccount } from "../account"
import { toMeeCompliantNexusAccount } from "./nexus-mee-compliant"

export type MeeNexusParams = {
  signer: Signer
  chains: NonEmptyArray<Chain>
}

export async function toMultichainNexusAccount(
  parameters: MeeNexusParams
): Promise<MultichainSmartAccount> {
  const { signer, chains } = parameters

  const accounts = await Promise.all(
    chains.map(
      async (chain) =>
        await toMeeCompliantNexusAccount({
          chain: chain,
          signer: signer,
          transport: http()
        })
    )
  )

  return new MultichainSmartAccount(accounts, signer)
}
