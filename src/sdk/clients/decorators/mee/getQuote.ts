import type { Address, Hex, OneOf } from "viem"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account/utils/getMultichainContract"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import type { ComposableCall } from "../../../modules/utils/composabilityCalls"
import type { BaseMeeClient } from "../../createMeeClient"

export const USEROP_MIN_EXEC_WINDOW_DURATION = 180

/**
 * Represents an abstract call to be executed in the transaction.
 * Each call specifies a target contract and optional parameters.
 */
export type AbstractCall = {
  /** Address of the contract to call */
  to: Address
  /**
   * Gas limit for the call execution. Defaults to 500_000n.
   * Overestimated gas will be refunded.
   */
  gasLimit?: bigint
} & OneOf<
  | { value: bigint; data?: Hex }
  | { value?: bigint; data: Hex }
  | { value: bigint; data: Hex }
>

/**
 * Information about the fee token to be used for the transaction
 */
export type FeeTokenInfo = {
  /**
   * Address of the fee token
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
   */
  address: Address
  /**
   * Chain ID where the fee token is deployed
   * @example 1 // Ethereum Mainnet
   */
  chainId: number
}

/**
 * Information about the instructions to be executed in the transaction
 * @internal
 */
export type Instruction = {
  /** Array of abstract calls to be executed in the transaction */
  calls: AbstractCall[] | ComposableCall[]
  /**
   * Chain ID where the transaction will be executed
   * @example 1 // Ethereum Mainnet
   */
  chainId: number
  /** Flag for composable call */
  isComposable?: boolean
}

/**
 * Represents a supertransaction, which is a collection of instructions
 * to be executed in a single transaction across multiple chains
 */
export type Supertransaction = {
  /** Array of instructions to be executed in the transaction */
  instructions: Instruction[]
  /** Token to be used for paying transaction fees */
  feeToken: FeeTokenInfo
}

/**
 * Union type for different instruction formats that can be provided
 */
export type InstructionLike =
  | Promise<Instruction>
  | Promise<Instruction[]>
  | Instruction[]
  | Instruction

/**
 * Parameters for creating a supertransaction with flexible instruction formats
 */
export type SupertransactionLike = {
  /** Array of instructions in various formats */
  instructions: InstructionLike[]
  /** Token to be used for paying fees */
  feeToken: FeeTokenInfo
}

/**
 * Supported wallet providers for executing transactions
 */
export type WalletProvider =
  | "BICO_V2"
  | "BICO_V2_EOA"
  | "SAFE_V141"
  | "ZERODEV_V24"
  | "ZERODEV_V31"

/**
 * Parameters required for requesting a quote from the MEE service
 */
export type GetQuoteParams = SupertransactionLike & {
  /**
   * Optional smart account to execute the transaction.
   * If not provided, uses the client's default account
   */
  account?: MultichainSmartAccount
  /**
   * Path to the quote endpoint. Defaults to "/quote"
   * @example "/quote"
   */
  path?: string
  /**
   * EOA address to be used for the transaction.
   * Only required when using permit-enabled tokens
   */
  eoa?: Address
  /**
   * Lower bound execution timestamp to be applied to all user operations
   */
  lowerBoundTimestamp?: number
  /**
   * Upper bound execution timestamp to be applied to all user operations
   */
  upperBoundTimestamp?: number
  /**
   * Whether to delegate the transaction to the account
   */
  delegate?: boolean
}

export type MeeAuthorization = {
  address: Hex
  chainId: Hex
  nonce: Hex
  r: Hex
  s: Hex
  v: Hex
  yParity: Hex
}
/**
 * Internal structure for submitting a quote request to the MEE service
 * @internal
 */
type QuoteRequest = {
  /** Array of user operations to be executed */
  userOps: {
    /** Address of the account initiating the operation */
    sender: string
    /** Encoded transaction data */
    callData: string
    /** Gas limit for the call execution */
    callGasLimit: string
    /** Account nonce */
    nonce: string
    /** Chain ID where the operation will be executed */
    chainId: string
    /** Lower bound timestamp for operation validity */
    lowerBoundTimestamp?: number
    /** Upper bound timestamp for operation validity */
    upperBoundTimestamp?: number
    /** EIP7702Auth */
    eip7702Auth?: MeeAuthorization
  }[]
  /** Payment details for the transaction */
  paymentInfo: PaymentInfo
}

/**
 * Basic payment information required for a quote request
 */
export type PaymentInfo = {
  /** Address of the account paying for the transaction */
  sender: Address
  /** Optional initialization code for account deployment */
  initCode?: Hex
  /** Address of the token used for payment */
  token: Address
  /** Current nonce of the sender account */
  nonce: string
  /** Chain ID where the payment will be processed */
  chainId: string
  /** EIP7702Auth */
  eip7702Auth?: MeeAuthorization
}

/**
 * Extended payment information including calculated token amounts
 */
export type FilledPaymentInfo = Required<PaymentInfo> & {
  /** Human-readable token amount */
  tokenAmount: string
  /** Token amount in wei */
  tokenWeiAmount: string
  /** Token value in the transaction */
  tokenValue: string
}

/**
 * Detailed user operation structure with all required fields
 */
export interface MeeFilledUserOp {
  /** Address of the account initiating the operation */
  sender: Address
  /** Account nonce */
  nonce: string
  /** Account initialization code */
  initCode: Hex
  /** Encoded transaction data */
  callData: Hex
  /** Gas limit for the call execution */
  callGasLimit: string
  /** Gas limit for verification */
  verificationGasLimit: string
  /** Maximum fee per gas unit */
  maxFeePerGas: string
  /** Maximum priority fee per gas unit */
  maxPriorityFeePerGas: string
  /** Encoded paymaster data */
  paymasterAndData: Hex
  /** Gas required before operation verification */
  preVerificationGas: string
}

/**
 * Extended user operation details including timing and gas parameters
 */
export interface MeeFilledUserOpDetails {
  /** Complete user operation data */
  userOp: MeeFilledUserOp
  /** Hash of the user operation */
  userOpHash: Hex
  /** MEE-specific hash of the user operation */
  meeUserOpHash: Hex
  /** Lower bound timestamp for operation validity */
  lowerBoundTimestamp: string
  /** Upper bound timestamp for operation validity */
  upperBoundTimestamp: string
  /** Maximum gas limit for the operation */
  maxGasLimit: string
  /** Maximum fee per gas unit */
  maxFeePerGas: string
  /** Chain ID where the operation will be executed */
  chainId: string
}

/**
 * Complete quote response from the MEE service
 */
export type GetQuotePayload = {
  /** Hash of the supertransaction */
  hash: Hex
  /** Address of the MEE node */
  node: Address
  /** Commitment hash */
  commitment: Hex
  /** Complete payment information with token amounts */
  paymentInfo: FilledPaymentInfo
  /** Array of user operations with their details */
  userOps: MeeFilledUserOpDetails[]
}

export type InitData = { eip7702Auth: MeeAuthorization } | { initCode: Hex }
export type InitDataOrUndefined = InitData | undefined

/**
 * Requests a quote from the MEE service for executing a set of instructions.
 * This function handles the complexity of creating a supertransaction quote
 * that can span multiple chains.
 *
 * @param client - MEE client instance used to make the request
 * @param parameters - Parameters for the quote request
 * @returns Promise resolving to a committed supertransaction quote
 *
 * @example
 * ```typescript
 * const quote = await getQuote(meeClient, {
 *   instructions: [{
 *     calls: [{
 *       to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
 *       data: "0x...",
 *       value: 0n
 *     }],
 *     chainId: 1 // Ethereum Mainnet
 *   }],
 *   feeToken: {
 *     address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
 *     chainId: 1
 *   }
 * });
 * ```
 *
 * @throws Will throw an error if:
 * - The account is not deployed on required chains
 * - The fee token is not supported
 * - The chain(s) are not supported by the node
 */
export const getQuote = async (
  client: BaseMeeClient,
  parameters: GetQuoteParams
): Promise<GetQuotePayload> => {
  const {
    account: account_ = client.account,
    instructions,
    feeToken,
    path = "quote",
    eoa,
    lowerBoundTimestamp: lowerBoundTimestamp_ = Math.floor(Date.now() / 1000),
    upperBoundTimestamp: upperBoundTimestamp_ = lowerBoundTimestamp_ +
      USEROP_MIN_EXEC_WINDOW_DURATION,
    delegate = false
  } = parameters

  const resolvedInstructions = await resolveInstructions(instructions)
  const validPaymentAccount = account_.deploymentOn(feeToken.chainId)

  const validFeeToken =
    validPaymentAccount &&
    client.info.supportedGasTokens
      .map(({ chainId }) => +chainId)
      .includes(feeToken.chainId)

  const validUserOps = resolvedInstructions.every(
    (userOp) =>
      account_.deploymentOn(userOp.chainId) &&
      client.info.supportedChains
        .map(({ chainId }) => +chainId)
        .includes(userOp.chainId)
  )

  if (!validFeeToken) {
    throw Error(
      `Fee token ${feeToken.address} is not supported on this chain: ${feeToken.chainId}`
    )
  }
  if (!validPaymentAccount) {
    throw Error(
      `Account is not deployed on necessary chain(s) ${feeToken.chainId}`
    )
  }
  if (!validUserOps) {
    throw Error(
      `User operation chain(s) not supported by the node: ${resolvedInstructions
        .map((x) => x.chainId)
        .join(", ")}`
    )
  }
  const userOpResults = await Promise.all(
    resolvedInstructions.map((userOp) => {
      const deployment = account_.deploymentOn(userOp.chainId, true)

      let callsPromise: Promise<Hex>

      if (userOp.isComposable) {
        callsPromise = deployment.encodeExecuteComposable(
          userOp.calls as ComposableCall[]
        )
      } else {
        callsPromise =
          userOp.calls.length > 1
            ? deployment.encodeExecuteBatch(userOp.calls as AbstractCall[])
            : deployment.encodeExecute(userOp.calls[0] as AbstractCall)
      }

      return Promise.all([
        callsPromise,
        deployment.getNonce(),
        deployment.isDeployed(),
        deployment.getInitCode(),
        deployment.address,
        userOp.calls
          .map((uo) => uo?.gasLimit ?? LARGE_DEFAULT_GAS_LIMIT)
          .reduce((curr, acc) => curr + acc)
          .toString(),
        userOp.chainId.toString(),
        deployment
      ])
    })
  )

  const hasProcessedInitData: string[] = [feeToken.chainId.toString()]
  const [nonce, isAccountDeployed, initCode] = await Promise.all([
    validPaymentAccount.getNonce(),
    validPaymentAccount.isDeployed(),
    validPaymentAccount.getInitCode()
  ])

  // Do authorization only if required as it requires signing
  const initData: InitDataOrUndefined = isAccountDeployed
    ? undefined
    : delegate
      ? { eip7702Auth: await validPaymentAccount.toDelegation() }
      : { initCode }

  const paymentInfo: PaymentInfo = {
    sender: validPaymentAccount.address,
    token: feeToken.address,
    nonce: nonce.toString(),
    chainId: feeToken.chainId.toString(),
    ...(eoa ? { eoa } : {}),
    ...initData
  }

  const userOps = await Promise.all(
    userOpResults.map(
      async ([
        callData,
        nonce_,
        isAccountDeployed,
        initCode,
        sender,
        callGasLimit,
        chainId,
        nexusAccount
      ]) => {
        let initDataOrUndefined: InitDataOrUndefined = undefined
        const shouldContainInitData =
          !hasProcessedInitData.includes(chainId) && !isAccountDeployed

        if (shouldContainInitData) {
          hasProcessedInitData.push(chainId)
          initDataOrUndefined = delegate
            ? { eip7702Auth: await nexusAccount.toDelegation() }
            : { initCode }
        }
        return {
          lowerBoundTimestamp: lowerBoundTimestamp_,
          upperBoundTimestamp: upperBoundTimestamp_,
          sender,
          callData,
          callGasLimit,
          nonce: nonce_.toString(),
          chainId,
          ...initDataOrUndefined
        }
      }
    )
  )

  const quoteRequest: QuoteRequest = { userOps, paymentInfo }

  return await client.request<GetQuotePayload>({ path, body: quoteRequest })
}

export default getQuote
