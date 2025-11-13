import { type AnyData, isPermitSupported } from "../../../modules"
import type { BaseMeeClient } from "../../createMeeClient"
import type { GetFusionQuoteParams } from "./getFusionQuote"
import type { GetOnChainQuotePayload } from "./getOnChainQuote"
import type { GetPermitQuotePayload } from "./getPermitQuote"
import type { GetQuoteParams, GetQuotePayload } from "./getQuote"
import { getSupportedFeeToken } from "./getSupportedFeeToken"
import {
  prepareSignablePermitQuotePayload,
  type TokenTrigger,
  type Trigger
} from "./signPermitQuote"

export type QuoteType = "simple" | "onchain" | "permit" | "mm-dtk"

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

  const { walletClient, address: spender } = client.account.deploymentOn(
    trigger.chainId,
    true
  )
  const owner = client.account.signer.address

  // This is a dummy quote payload to get the permit token fallback to onchain mode state.
  const dummyQuotePayload = {
    ...payload,
    quote: {
      hash: "0xffff" // Dummy sprtxHash
    }
  } as GetPermitQuotePayload

  // after this point, trigger can only be of type TokenTrigger
  try {
    const [permitEnabled, { fallbackToOnchainMode }] = await Promise.all([
      isPermitTokenInfo(
        client,
        trigger as TokenTrigger // trigger can only be of type TokenTrigger at this point
      ),
      prepareSignablePermitQuotePayload(
        dummyQuotePayload,
        owner,
        spender,
        walletClient
      )
    ])

    // If fallbackToOnchainMode is true, then permit flow has some issues and we avoid using permit mode.
    if (fallbackToOnchainMode) return false

    // If permit is enabled, it is a permit quote
    return permitEnabled
  } catch {
    // If there is any error in detecting the permit support, the flow will fallback to onchain mode
    return false
  }
}

const isOnChainQuote = async (payload: AnyData): Promise<boolean> => {
  const isTriggerAvailable = "trigger" in payload

  // If trigger is not available, it is not considered as on chain quote
  if (!isTriggerAvailable) return false

  const trigger = payload.trigger as Trigger

  // If triggger has a call, it is considered as on chain quote
  if ("call" in trigger) {
    return true
  }

  // Permit check is done before this function call. If this function is called, it means permit is skipped and it can be executed via onchain mode
  // Even if the permit flow fallbacks to onchain mode ? This will be always true.
  return true
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
  if (await isOnChainQuote(quoteParams)) {
    return "onchain"
  }
  throw new Error("Invalid quote, can't determine quote type")
}
