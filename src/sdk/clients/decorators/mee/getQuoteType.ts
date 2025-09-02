import { type AnyData, isPermitSupported } from "../../../modules"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetFusionQuoteParams } from "./getFusionQuote"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { GetQuoteParams, GetQuotePayload } from "./getQuote"
import { getSupportedFeeToken } from "./getSupportedFeeToken"
import type { TokenTrigger, Trigger } from "./signPermitQuote"

export type QuoteType = "simple" | "onchain" | "permit"

export const isPermitTokenInfo = async (
  client: BaseMeeClient,
  trigger: TokenTrigger
): Promise<boolean> => {
  let permitEnabled = false

  const supportedFeeTokenInfo = await getSupportedFeeToken(client, {
    tokenAddress: trigger.tokenAddress,
    chainId: trigger.chainId
  })

  if (supportedFeeTokenInfo.supportedFeeToken) {
    // detect w/o extra RPCcall
    permitEnabled =
      supportedFeeTokenInfo.supportedFeeToken.permitEnabled || false
  } else {
    const { walletClient } = client.account.deploymentOn(trigger.chainId, true)
    // detect via RPCcall
    permitEnabled = await isPermitSupported(walletClient, trigger.tokenAddress)
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
  client: BaseMeeClient,
  payload: AnyData
): Promise<boolean> => {
  const isTriggerAvailable = "trigger" in payload

  // If trigger is not available, it is not considered as permit quote
  if (!isTriggerAvailable) return false

  const trigger = payload.trigger as Trigger

  // If trigger call is available, it is not permit quote
  if ("call" in trigger) {
    return false
  }
  // after this point, trigger can only be of type TokenTrigger
  const permitEnabled = await isPermitTokenInfo(
    client,
    trigger as TokenTrigger // trigger can only be of type TokenTrigger at this point
  )

  // If permit is enabled, it is a permit quote
  return permitEnabled
}

const isOnChainQuote = async (
  client: BaseMeeClient,
  payload: AnyData
): Promise<boolean> => {
  const isTriggerAvailable = "trigger" in payload

  // If trigger is not available, it is not considered as on chain quote
  if (!isTriggerAvailable) return false

  const trigger = payload.trigger as Trigger

  // If triggger has a call, it is considered as on chain quote
  if ("call" in trigger) {
    return true
  }

  const permitEnabled = await isPermitTokenInfo(
    client,
    trigger as TokenTrigger // trigger can only be of type TokenTrigger at this point
  )

  // If permit is enabled, it is not an on chain quote
  return !permitEnabled
}

// NOTE: MM DTK is not supported for now - It is experimental and need to support once it is mainstream
export const getQuoteType = async (
  client: BaseMeeClient,
  quoteParams:
    | GetQuotePayload
    | GetQuoteParams
    | GetPermitQuotePayload
    | GetOnChainQuotePayload
    | GetFusionQuoteParams
): Promise<QuoteType> => {
  // If the quote payload doesn't have trigger ? It is considered as normal quote
  if (isNormalQuote(quoteParams)) {
    return "simple"
  }
  if (await isPermitQuote(client, quoteParams)) {
    return "permit"
  }
  if (await isOnChainQuote(client, quoteParams)) {
    return "onchain"
  }
  throw new Error("Invalid quote, can't determine signature type")
}
