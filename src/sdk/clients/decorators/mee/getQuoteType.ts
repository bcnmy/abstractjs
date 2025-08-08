import type { Address, WalletClient } from "viem"
import { type AnyData, isPermitSupported } from "../../../modules"
import type { GetFusionQuoteParams } from "./getFusionQuote"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetPaymentTokenPayload } from "./getPaymentToken"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { GetQuoteParams, GetQuotePayload } from "./getQuote"
import type { Trigger } from "./signPermitQuote"

export type QuoteType = "simple" | "onchain" | "permit"

export const isPermitTokenInfo = async (
  walletClient: WalletClient,
  paymentTokenInfo: GetPaymentTokenPayload,
  tokenAddress: Address,
  chainId: number
): Promise<boolean> => {
  let permitEnabled = false

  if (paymentTokenInfo.paymentToken) {
    permitEnabled = paymentTokenInfo.paymentToken.permitEnabled || false
  } else if (paymentTokenInfo.isArbitraryPaymentTokensSupported) {
    permitEnabled = await isPermitSupported(walletClient, tokenAddress)
  } else {
    throw new Error(
      `Payment token (${tokenAddress}) not supported for chain ${chainId}`
    )
  }

  return permitEnabled
}

const isNormalQuote = (
  payload: AnyData
): payload is GetQuotePayload | GetQuoteParams => {
  const isTriggerAvailable = "trigger" in payload
  return !isTriggerAvailable
}

const isPermitQuote = async (
  walletClient: WalletClient,
  payload: AnyData,
  paymentTokenInfo?: GetPaymentTokenPayload
): Promise<boolean> => {
  const isTriggerAvailable = "trigger" in payload

  // If trigger is not available ? It is not considered as permit quote
  if (!isTriggerAvailable) return false

  const trigger = payload.trigger as Trigger

  // If trigger call is available ? It is not permit quote
  if ("call" in trigger) {
    return false
  }

  // For non normal quote, if the payment info is not available ?
  // It means the token is not supported by the network and also swap routers
  if (!paymentTokenInfo) {
    throw new Error(
      `Payment token (${trigger.tokenAddress}) not supported for chain ${trigger.chainId}`
    )
  }

  const permitEnabled = await isPermitTokenInfo(
    walletClient,
    paymentTokenInfo,
    trigger.tokenAddress,
    trigger.chainId
  )

  return !!permitEnabled
}

const isOnChainQuote = async (
  walletClient: WalletClient,
  payload: AnyData,
  paymentTokenInfo?: GetPaymentTokenPayload
): Promise<boolean> => {
  const isTriggerAvailable = "trigger" in payload

  // If trigger is not available ? It is not considered as on chain quote
  if (!isTriggerAvailable) return false

  const trigger = payload.trigger as Trigger

  // If triggger has a call ? It is considered as on chain quote
  if ("call" in trigger) {
    return true
  }

  // For non normal quote, if the payment info is not available ?
  // It means the token is not supported by the network and also swap routers
  if (!paymentTokenInfo) {
    throw new Error(
      `Payment token (${trigger.tokenAddress}) not supported for chain ${trigger.chainId}`
    )
  }

  const permitEnabled = await isPermitTokenInfo(
    walletClient,
    paymentTokenInfo,
    trigger.tokenAddress,
    trigger.chainId
  )

  // If permit is enabled ? It is not an on chain quote
  return !permitEnabled
}

// NOTE: MM DTK is not supported for now - It is experimental and need to support once it is mainstream
export const getQuoteType = async (
  walletClient: WalletClient,
  quoteParams:
    | GetQuotePayload
    | GetQuoteParams
    | GetPermitQuotePayload
    | GetOnChainQuotePayload
    | GetFusionQuoteParams,
  paymentTokenInfo?: GetPaymentTokenPayload
): Promise<QuoteType> => {
  // If the quote payload doesn't have trigger ? It is considered as normal quote
  if (isNormalQuote(quoteParams)) {
    return "simple"
  }

  if (await isPermitQuote(walletClient, quoteParams, paymentTokenInfo)) {
    return "permit"
  }

  if (await isOnChainQuote(walletClient, quoteParams, paymentTokenInfo)) {
    return "onchain"
  }

  throw new Error("Invalid quote, can't determine signature type")
}
