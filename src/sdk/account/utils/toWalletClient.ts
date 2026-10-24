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
  // Only route through the injected browser provider when the signer was created
  // from one (transport key "custom") AND an EIP-1193 provider is actually
  // present on `window.ethereum`. When a user connects without a wallet
  // extension (e.g. via a 3rd-party email / web2 connector), `window.ethereum`
  // is undefined; `custom(undefined)` previously produced a transport that threw
  // "Cannot read properties of undefined (reading 'request')" from
  // toNexusAccount. In that case fall back to the resolved (local) signer and
  // the provided transport. See https://github.com/bcnmy/abstractjs/issues/212
  const injectedProvider =
    typeof window !== "undefined"
      ? (window as { ethereum?: unknown }).ethereum
      : undefined
  const useBrowserProvider =
    unresolvedSigner?.transport?.key === "custom" && Boolean(injectedProvider)
  return createWalletClient(
    useBrowserProvider
      ? {
          account: resolvedSigner.address,
          chain,
          // @ts-ignore
          transport: custom(injectedProvider)
        }
      : {
          account: resolvedSigner,
          chain,
          transport
        }
  ).extend(publicActions) as ToWalletClientReturnType
}
