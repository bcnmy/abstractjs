import type { WalletClient } from "viem"
import { type AnyData, isPermitSupported } from "../../../modules"
import type { GetFusionQuoteParams } from "./getFusionQuote"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetPaymentTokenPayload } from "./getPaymentToken"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { GetQuoteParams, GetQuotePayload } from "./getQuote"
import type { TokenTrigger, Trigger } from "./signPermitQuote"

export type QuoteType = "simple" | "onchain" | "permit"

export const isPermitTokenInfo = async (
  triggerWalletClient: WalletClient,
  trigger: TokenTrigger,
  paymentTokenInfo?: GetPaymentTokenPayload
): Promise<boolean> => {
  let permitEnabled = false

  if (!paymentTokenInfo) {
    // if payment token is not specified at this point,
    // it means the trigger token is used to choose b/w:
    // `to permit` or `not to permit`
    permitEnabled = await isPermitSupported(
      triggerWalletClient,
      trigger.tokenAddress
    )
  } else if (!paymentTokenInfo.paymentToken) {
    // if payment token is not specified, it means the trigger token can be used as payment token
    // but only if we support arbitrary payment tokens for this quote
    if (paymentTokenInfo.isArbitraryPaymentTokensSupported) {
      permitEnabled = await isPermitSupported(
        triggerWalletClient,
        trigger.tokenAddress
      )
    }
  } else if (paymentTokenInfo.paymentToken.address !== trigger.tokenAddress) {
    // if payment token is defined and different from the trigger token, it means
    // 'to permit' or 'not to permit' is decided by the trigger token, not the payment token
    // coz in this case, fee is paid directly from the orchestrator account, w/o
    // transferring the fee token to the orchestrator account via fusion
    // so only trigger token is transferred via fusion
    permitEnabled = await isPermitSupported(
      triggerWalletClient,
      trigger.tokenAddress
    )
  } else {
    // at this point, payment token is defined and is the same as the trigger token
    permitEnabled = paymentTokenInfo.paymentToken.permitEnabled || false
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
  triggerWalletClient: WalletClient,
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
  // after this point, trigger can only be of type TokenTrigger

  const permitEnabled = await isPermitTokenInfo(
    triggerWalletClient,
    trigger as TokenTrigger, // trigger can only be of type TokenTrigger at this point
    paymentTokenInfo
  )

  return !!permitEnabled
}

const isOnChainQuote = async (
  triggerWalletClient: WalletClient,
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

  const permitEnabled = await isPermitTokenInfo(
    triggerWalletClient,
    trigger as TokenTrigger, // trigger can only be of type TokenTrigger at this point
    paymentTokenInfo
  )

  // If permit is enabled ? It is not an on chain quote
  return !permitEnabled
}

// NOTE: MM DTK is not supported for now - It is experimental and need to support once it is mainstream
export const getQuoteType = async (
  triggerWalletClient: WalletClient,
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

  if (!paymentTokenInfo && !("sponsorship" in quoteParams)) {
    throw new Error(
      "Detecting quote type: Payment token info not specified in a non-sponsored flow"
    )
  }

  if (await isPermitQuote(triggerWalletClient, quoteParams, paymentTokenInfo)) {
    return "permit"
  }

  if (
    await isOnChainQuote(triggerWalletClient, quoteParams, paymentTokenInfo)
  ) {
    return "onchain"
  }

  throw new Error("Invalid quote, can't determine signature type")
}
