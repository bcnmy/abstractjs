import {
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
  createWalletClient,
  custom,
  publicActions
} from "viem"
import type { ToNexusSmartAccountParameters } from "../toNexusAccount"
import type { Signer } from "./toSigner"

export type ToWalletClientParameters = {
  unresolvedSigner: ToNexusSmartAccountParameters["signer"]
  resolvedSigner: Signer
  chain: Chain
  transport: Transport
}
export type ToWalletClientReturnType = WalletClient<Transport, Chain, Account>

export const toWalletClient = ({
  unresolvedSigner,
  resolvedSigner,
  chain,
  transport
}: ToWalletClientParameters): ToWalletClientReturnType => {
  const browserSigner = unresolvedSigner?.transport?.key === "custom"
  return createWalletClient(
    browserSigner
      ? {
          account: resolvedSigner.address,
          chain,
          // @ts-ignore
          transport: custom(window?.ethereum)
        }
      : {
          account: resolvedSigner,
          chain,
          transport
        }
  ).extend(publicActions) as ToWalletClientReturnType
}
