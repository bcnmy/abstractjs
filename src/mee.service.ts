import { type Address, type Hex, concatHex } from "viem"
import type { MultichainSmartAccount } from "./account-vendors/account"
import type { Supertransaction } from "./workflow"

const DEFAULT_MEE_NODE_URL = "https://mee-node.biconomy.io"

type QuoteRequestUserOp = {
  sender: string
  callData: string
  callGasLimit: string
  nonce: string
  chainId: string
}

type PaymentInfo = {
  sender: string
  initCode?: string
  token: string
  nonce: string
  chainId: string
}

type QuoteRequest = {
  userOps: QuoteRequestUserOp[]
  paymentInfo: PaymentInfo
}

export interface FilledPaymentInfo {
  sender: Address
  initCode: Hex
  token: Address
  nonce: string
  chainId: string
  tokenAmount: string
  tokenWeiAmount: string
  tokenValue: string
}

export interface MeeFilledUserOp {
  sender: Address
  nonce: string
  initCode: Hex
  callData: Hex
  callGasLimit: string
  verificationGasLimit: string
  maxFeePerGas: string
  maxPriorityFeePerGas: string
  paymasterAndData: Hex
  preVerificationGas: string
}

export interface MeeFilledUserOpDetails {
  userOp: MeeFilledUserOp
  userOpHash: Hex
  meeUserOpHash: Hex
  lowerBoundTimestamp: string
  upperBoundTimestamp: string
  maxGasLimit: string
  maxFeePerGas: string
  chainId: string
}

export interface MeeCommitedSupertransactionQuote {
  hash: Hex
  node: Address
  commitment: Hex
  paymentInfo: FilledPaymentInfo
  userOps: MeeFilledUserOpDetails[]
}

export type MeeServiceInitParams = {
  meeNodeUrl: `https://${string}` | `http://${string}`
}

export type ExecuteMeeQuoteResponse = {
  hash: Hex
}

export type MeeExecuteParams = {
  quote: MeeCommitedSupertransactionQuote
  signature: FormattedMeeSignature
}

export class MeeService {
  private nodeUrl: string

  constructor(params?: MeeServiceInitParams) {
    this.nodeUrl = params?.meeNodeUrl ?? DEFAULT_MEE_NODE_URL
  }

  async getQuote({
    supertransaction,
    account
  }: {
    supertransaction: Supertransaction
    account: MultichainSmartAccount
  }) {
    const quoteUrl = `${this.nodeUrl}/v1/quote`

    const userOps = supertransaction.instructions

    const userOpData = await Promise.all(
      userOps.map(async (userOp) => {
        const deployment = account.deploymentOn(userOp.chainId)
        if (!deployment) {
          throw Error(`No account deployment found for chain ${userOp.chainId}`)
        }

        // Add up all the provided gasLimits to get the
        // total callGasLimit for all the calls in the
        // batch
        const callGasLimit = userOp.calls
          .map((tx) => tx.gasLimit)
          .reduce((curr, acc) => curr + acc)
          .toString()

        const [callData, nonce, isAccountDeployed] = await Promise.all([
          deployment.encodeExecuteBatch(userOp.calls),
          deployment.getNonce(),
          deployment.isDeployed()
        ])

        const baseUserOpData = {
          sender: deployment.address,
          callData: callData,
          callGasLimit,
          nonce: nonce.toString(),
          chainId: userOp.chainId.toString()
        }

        return isAccountDeployed
          ? baseUserOpData
          : {
              ...baseUserOpData,
              initCode: await deployment.getInitCode()
            }
      })
    )

    const paymentAccount = account.deploymentOn(
      supertransaction.feeToken.chainId
    )
    if (!paymentAccount) {
      throw Error(`
        Account not initialized on chainId: ${supertransaction.feeToken.chainId} where
        you have requested the fee to be paid.
      `)
    }

    const paymentNonce = await paymentAccount.getNonce()

    const paymentInfoBaseData = {
      sender: paymentAccount.address,
      token: supertransaction.feeToken.address,
      nonce: paymentNonce.toString(),
      chainId: supertransaction.feeToken.chainId.toString()
    }

    const paymentInfoData: PaymentInfo = (await paymentAccount.isDeployed())
      ? {
          ...paymentInfoBaseData
        }
      : {
          ...paymentInfoBaseData,
          initCode: paymentAccount.getInitCode()
        }

    const quoteRequest: QuoteRequest = {
      userOps: userOpData,
      paymentInfo: paymentInfoData
    }

    const response = await fetch(quoteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(quoteRequest)
    })

    if (!response.ok) {
      const error = await response.text()
      console.log({ response })
      throw new Error(`Failed to get quote from MEE Node: ${error}`)
    }

    return (await response.json()) as MeeCommitedSupertransactionQuote
  }

  async execute(parameters: {
    quote: MeeCommitedSupertransactionQuote
    signature: FormattedMeeSignature
  }): Promise<ExecuteMeeQuoteResponse> {
    const { quote, signature: signedHash } = parameters
    const request = {
      ...quote,
      signature: signedHash
    }
    const response = await fetch(`${this.nodeUrl}/v1/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(
        `Failed to execute transaction through the MEE Node: ${error}`
      )
    }

    return (await response.json()) as ExecuteMeeQuoteResponse
  }
}

export type FormattedMeeSignature = Hex

export type ExecutionMode =
  | "direct-to-mee"
  | "fusion-with-onchain-tx"
  | "fusion-with-erc20permit"

export function formatMeeSignature(parameters: {
  signedHash: Hex
  executionMode: ExecutionMode
}): FormattedMeeSignature {
  const executionModeToSignaturePrefix = () => {
    switch (parameters.executionMode) {
      case "direct-to-mee":
        return "0x00"
      case "fusion-with-onchain-tx":
        return "0x01"
      case "fusion-with-erc20permit":
        return "0x02"
    }
  }

  return concatHex([executionModeToSignaturePrefix(), parameters.signedHash])
}

export function createMeeService(params?: MeeServiceInitParams) {
  console.warn(`
    --------------------------- READ ----------------------------------------------
    You are using the Developer Preview of the Biconomy MEE! The SDK has not been
    thoroughly tested and the underlying contracts are still in the auditing process.
    The interface, package name and developer flow might change significantly from now
    until the release data.
    
    This Developer preview is meant only as a demonstrator of the capabilities 
    for the MEE stack. Do not use in commercial projects!
    -------------------------------------------------------------------------------
  `)
  return new MeeService(params)
}
