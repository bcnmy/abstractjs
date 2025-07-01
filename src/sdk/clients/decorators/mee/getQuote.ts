import { type Address, type Hex, type OneOf, zeroAddress } from "viem"
import type { SignAuthorizationReturnType } from "viem/accounts"
import { buildComposable } from "../../../account/decorators"
import type { MultichainSmartAccount } from "../../../account/toMultiChainNexusAccount"
import type { NonceInfo } from "../../../account/toNexusAccount"
import { addressEquals } from "../../../account/utils/Utils"
import { LARGE_DEFAULT_GAS_LIMIT } from "../../../account/utils/getMultichainContract"
import { resolveInstructions } from "../../../account/utils/resolveInstructions"
import { SMART_SESSIONS_ADDRESS } from "../../../constants"
import type { RuntimeValue } from "../../../modules"
import {
  type ComposableCall,
  greaterThanOrEqualTo,
  runtimeERC20BalanceOf,
  runtimeNonceOf
} from "../../../modules/utils/composabilityCalls"
import type { GrantPermissionResponseEntry } from "../../../modules/validators/smartSessions/decorators/grantPermission"
import createHttpClient, { type Url } from "../../createHttpClient"
import {
  type BaseMeeClient,
  DEFAULT_MEE_SPONSORSHIP_CHAIN_ID,
  DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT,
  DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS,
  DEFAULT_PATHFINDER_URL,
  DEFAULT_STAGING_PATHFINDER_URL
} from "../../createMeeClient"

export const USEROP_MIN_EXEC_WINDOW_DURATION = 180

export const CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION =
  USEROP_MIN_EXEC_WINDOW_DURATION / 2

export const DEFAULT_GAS_LIMIT = 75_000n

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
  feeToken?: FeeTokenInfo
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
 * Parameters for a cleanup userops
 */
export type CleanUp = {
  /**
   * The address of the token to cleanup
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
   */
  tokenAddress: Address
  /**
   * The chainId to use
   * @example 1 // Ethereum Mainnet
   */
  chainId: number
  /**
   * Amount of the token to use, in the token's smallest unit
   * @example 1000000n // 1 USDC (6 decimals)
   */
  amount?: bigint
  /**
   * Custom gas limit for cleanup userOp
   * @example 1n
   */
  gasLimit?: bigint
  /**
   * The address of the receiver where the token to cleanup
   * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // EVM address
   */
  recipientAddress: Address
  /**
   * The user ops dependency for nonce injection
   * @example [userOp(1)]
   */
  dependsOn?: number[]
}

/**
 * Parameters for a sponsorship
 */
export type SponsorshipOptionsParams = {
  /**
   * Sponsorship url for requesting sponsorship
   * @example http://dapp-backend/sponsor-supertx
   */
  url: Url
  /**
   * Custom headers to be passed to self hosted sponsorship backends.
   */
  customHeaders?: Record<string, string>
  /**
   * Gas tank parameters
   */
  gasTank: {
    /**
     * The chainId to use
     * @example 1 // Ethereum Mainnet
     */
    chainId: number
    /**
     * The gas tank address for sponshorship
     * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
     */
    address: Address
    /**
     * The token address for sponshorship
     * @example "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" // USDC
     */
    token: Address
  }
}

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
   * An address to be used as funds origin in the payment userOp
   *
   * Note: In fact this param should be named `paymentOrigin`,
   * as in some cases (for example MM DTK fusion mode) it
   * is not an EOA, but a smart account.
   *
   * We keep it as `eoa` for backward compatibility for now.
   * TODO: rename to `paymentOrigin` when it is possible.
   * It will require according changes on the node side.
   *
   * @example "0x1234567890123456789012345678901234567890"
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
   * gasLimit option to override the default payment gas limit
   */
  gasLimit?: bigint
  /**
   * token cleanup option to pull the funds on failure or dust cleanup
   */
  cleanUps?: CleanUp[]
  /**
   * Active module address. Used to fetch the nonce for the active module
   */
  moduleAddress?: Address
  /**
   * Short encoding flag for fusion isValidsignatureWithSender/validateSignatureWithData functions
   * This flag is set true when the whole superTxn with all entries require short encoding
   * This is a special case when all the sigs are going to be validated via short flow. For example,
   * when the superTxn is signed with session key enabled via Smart Sessions Module.
   * For more details see https://github.com/bcnmy/mee-contracts/blob/main/contracts/lib/fusion/PermitValidatorLib.sol#L32-L58
   * https://github.com/bcnmy/mee-contracts/blob/main/contracts/lib/fusion/PermitValidatorLib.sol#L134C14-L156
   */
  shortEncodingSuperTxn?: boolean
} & OneOf<
    | {
        /**
         * Token to be used for paying transaction fees
         */
        feeToken: FeeTokenInfo
      }
    | {
        /**
         * sponsorship flag to enable the sponsored super transactions.
         */
        sponsorship: true
        /**
         * Sponsorship options for overrides
         */
        sponsorshipOptions?: SponsorshipOptionsParams
      }
  > &
  OneOf<
    | {
        /**
         * Whether to delegate the transaction to the account
         */
        delegate?: false
      }
    | {
        /**
         * Whether to delegate the transaction to the account
         */
        delegate: true
        /**
         * The authorization data for the transaction. Should be a valid Viem compatible Authorization param on chainId 0
         * If not provided, the account will be delegated to the implementation address, using chainId 0.
         */
        authorization?: SignAuthorizationReturnType
      }
  >

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
    /** Cleanup userop flag - Special user op */
    isCleanUpUserOp?: boolean
    /** Short encoding flag for fusion isValidsignatureWithSender/validateSignatureWithData functions
     * For more details see https://github.com/bcnmy/mee-contracts/blob/main/contracts/lib/fusion/PermitValidatorLib.sol#L32-L58
     * https://github.com/bcnmy/mee-contracts/blob/main/contracts/lib/fusion/PermitValidatorLib.sol#L134C14-L156
     **/
    shortEncoding?: boolean
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
  /** Short encoding flag @see QuoteRequest.shortEncoding */
  shortEncoding?: boolean
  /** Payment userop callGasLimit */
  callGasLimit?: bigint
  /** Sponsorship flag  */
  sponsored?: boolean
  /** Sponsorship url  */
  sponsorshipUrl?: Url
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
  /** UserOp signature signed by paymaster for sponsorship  */
  signature?: Hex
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
  /** EIP7702 authorization info */
  eip7702Auth?: MeeAuthorization
  /** Cleanup userop flag - Special user op */
  isCleanUpUserOp?: boolean
  /** Optional Session details for redeeming a permission */
  sessionDetails?: GrantPermissionResponseEntry
  /** Short encoding flag @see QuoteRequest.shortEncoding
   *  It is expected to be set here because it is returned by the node
   *  and the node always knows if the given superTxn entry's hash
   *  was short encoded or not. This flag is then passed to the node
   *  when signing the quote, so the node can build short or full
   *  fusion signature for a given userOp
   **/
  shortEncoding: boolean
  /** Userop signature signed by sponsorship service */
  signature?: Hex
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
    cleanUps,
    path = "quote",
    lowerBoundTimestamp: lowerBoundTimestamp_ = Math.floor(Date.now() / 1000),
    upperBoundTimestamp: upperBoundTimestamp_ = lowerBoundTimestamp_ +
      USEROP_MIN_EXEC_WINDOW_DURATION,
    delegate = false,
    authorization,
    moduleAddress,
    shortEncodingSuperTxn = false,
    sponsorship = false,
    sponsorshipOptions
  } = parameters

  const resolvedInstructions = await resolveInstructions(instructions)

  const validUserOps = resolvedInstructions.every(
    (userOp) =>
      account_.deploymentOn(userOp.chainId) &&
      client.info.supportedChains
        .map(({ chainId }) => +chainId)
        .includes(userOp.chainId)
  )

  if (!validUserOps) {
    throw Error(
      `User operation chain(s) not supported by the node: ${resolvedInstructions
        .map((x) => x.chainId)
        .join(", ")}`
    )
  }

  const hasProcessedInitData: string[] = []
  const paymentVerificationGasLimit = resolvePaymentUserOpVerificationGasLimit({
    moduleAddress,
    sponsorship
  })

  const { paymentInfo, isInitDataProcessed } = await preparePaymentInfo(
    client,
    {
      ...parameters,
      paymentVerificationGasLimit
    }
  )

  if (isInitDataProcessed) hasProcessedInitData.push(paymentInfo.chainId)

  const preparedUserOps = await prepareUserOps(
    account_,
    resolvedInstructions,
    false,
    moduleAddress
  )

  // If cleanup is configured, the cleanup userops will be appended to the existing userops
  // Every cleanup is a separate user op and will be executed if certain conditions met
  if (cleanUps && cleanUps.length > 0) {
    const userOpsNonceInfo: NonceInfo[] = preparedUserOps.map(
      ([, { nonceKey, nonce }]) => ({ nonce, nonceKey })
    )

    const cleanUpUserOps = await prepareCleanUpUserOps(
      account_,
      userOpsNonceInfo,
      cleanUps,
      moduleAddress
    )

    preparedUserOps.push(...cleanUpUserOps)
  }

  // complete the userOps including cleanup ones
  const indexPerChainId = new Map<string, number>()
  const userOps = await Promise.all(
    preparedUserOps.map(
      async ([
        callData,
        { nonce },
        isAccountDeployed,
        initCode,
        sender,
        callGasLimit,
        chainId,
        isCleanUpUserOp,
        nexusAccount,
        shortEncoding
      ]) => {
        let initDataOrUndefined: InitDataOrUndefined = undefined
        if (!indexPerChainId.has(chainId)) {
          indexPerChainId.set(chainId, 0)
        }

        const shouldContainInitData =
          !hasProcessedInitData.includes(chainId) && !isAccountDeployed

        if (shouldContainInitData) {
          hasProcessedInitData.push(chainId)
          initDataOrUndefined = delegate
            ? {
                eip7702Auth: await nexusAccount.toDelegation({ authorization })
              }
            : { initCode }
        }

        const verificationGasLimit = resolveVerificationGasLimit({
          moduleAddress,
          sponsorship,
          index: indexPerChainId.get(chainId)!,
          paymentChainId: paymentInfo.chainId,
          currentChainId: chainId
        })

        indexPerChainId.set(chainId, indexPerChainId.get(chainId)! + 1)

        return {
          lowerBoundTimestamp: lowerBoundTimestamp_,
          upperBoundTimestamp: isCleanUpUserOp
            ? upperBoundTimestamp_ +
              CLEANUP_USEROP_EXTENDED_EXEC_WINDOW_DURATION
            : upperBoundTimestamp_,
          sender,
          callData,
          callGasLimit,
          nonce: nonce.toString(),
          chainId,
          isCleanUpUserOp,
          ...initDataOrUndefined,
          ...verificationGasLimit,
          shortEncoding: shortEncodingSuperTxn || shortEncoding
        }
      }
    )
  )

  const quoteRequest: QuoteRequest = { userOps, paymentInfo }

  let quote = await client.request<GetQuotePayload>({
    path,
    body: quoteRequest
  })

  if (sponsorship && sponsorshipOptions) {
    const isSelfHostedSponsorship = ![
      DEFAULT_PATHFINDER_URL,
      DEFAULT_STAGING_PATHFINDER_URL
    ].includes(sponsorshipOptions.url)

    if (isSelfHostedSponsorship) {
      const selfHostedClient = createHttpClient(sponsorshipOptions.url)

      quote = await selfHostedClient.request<GetQuotePayload>({
        path: `sponsorship/sign/${sponsorshipOptions.gasTank.chainId}/${sponsorshipOptions.gasTank.address}`,
        method: "POST",
        body: quote,
        ...(sponsorshipOptions.customHeaders
          ? { headers: sponsorshipOptions.customHeaders }
          : {})
      })
    }
  }

  return quote
}

const preparePaymentInfo = async (
  client: BaseMeeClient,
  parameters: GetQuoteParams & {
    paymentVerificationGasLimit?: { verificationGasLimit: string }
  }
) => {
  const {
    account: account_ = client.account,
    eoa,
    feeToken,
    delegate = false,
    gasLimit,
    authorization,
    sponsorship,
    sponsorshipOptions,
    shortEncodingSuperTxn,
    moduleAddress = zeroAddress as Address,
    paymentVerificationGasLimit
  } = parameters

  let paymentInfo: PaymentInfo | undefined = undefined
  let isInitDataProcessed = false

  if (sponsorship) {
    // For sponsorship, the sender should be the sponsorship SCA which will bare the gas payment for developers
    let sender = DEFAULT_MEE_SPONSORSHIP_PAYMASTER_ACCOUNT
    let token = DEFAULT_MEE_SPONSORSHIP_TOKEN_ADDRESS
    let chainId = DEFAULT_MEE_SPONSORSHIP_CHAIN_ID
    let sponsorshipUrl: Url = DEFAULT_PATHFINDER_URL

    if (sponsorshipOptions) {
      sender = sponsorshipOptions.gasTank.address
      token = sponsorshipOptions.gasTank.token
      chainId = sponsorshipOptions.gasTank.chainId
      sponsorshipUrl = sponsorshipOptions.url
    }

    const sponsorshipClient = createHttpClient(sponsorshipUrl)

    const { nonce } = await sponsorshipClient.request<{
      nonce: string
      nonceKey: string
    }>({
      path: `sponsorship/nonce/${chainId}/${sender}`,
      method: "GET",
      ...(sponsorshipOptions?.customHeaders
        ? { headers: sponsorshipOptions.customHeaders }
        : {})
    })

    paymentInfo = {
      sponsored: true,
      sender,
      token,
      nonce,
      callGasLimit: gasLimit || DEFAULT_GAS_LIMIT,
      chainId: chainId.toString(),
      sponsorshipUrl,
      ...(eoa ? { eoa } : {}),
      // For sponsorship, the sponsorship paymaster EOA is always assumed to be deployed and funded already
      // So initCode will be always undefined
      initCode: undefined
      // no short encodings
    }

    // Init code / authorization list will not be added to payment userOp in the case of sponsorship. It will be added in the
    // first developer defined userOp. To make this happen, this field should be false
    isInitDataProcessed = false
  } else {
    if (!feeToken) throw Error("Fee token should be configured")

    const validPaymentAccount = account_.deploymentOn(feeToken.chainId)

    if (!validPaymentAccount) {
      throw Error(
        `Account is not deployed on necessary chain(s) ${feeToken.chainId}`
      )
    }

    // TODO: Check the correctness of this while testing. This is a old logic
    const validFeeToken =
      validPaymentAccount &&
      client.info.supportedGasTokens
        .map(({ chainId }) => +chainId)
        .includes(feeToken.chainId)

    if (!validFeeToken) {
      throw Error(
        `Fee token ${feeToken.address} is not supported on this chain: ${feeToken.chainId}`
      )
    }

    const [nonce, isAccountDeployed, initCode] = await Promise.all([
      validPaymentAccount.getNonceWithKey(validPaymentAccount.address, {
        moduleAddress
      }),
      validPaymentAccount.isDeployed(),
      validPaymentAccount.getInitCode()
    ])

    // Do authorization only if required as it requires signing
    const initData: InitDataOrUndefined = isAccountDeployed
      ? undefined
      : delegate
        ? {
            eip7702Auth: await validPaymentAccount.toDelegation({
              authorization
            })
          }
        : { initCode }

    paymentInfo = {
      sponsored: false,
      sender: validPaymentAccount.address,
      token: feeToken.address,
      nonce: nonce.nonce.toString(),
      callGasLimit: gasLimit || DEFAULT_GAS_LIMIT,
      chainId: feeToken.chainId.toString(),
      ...(eoa ? { eoa } : {}),
      ...initData,
      shortEncoding: shortEncodingSuperTxn,
      ...paymentVerificationGasLimit
    }

    // Init code / authorization list will added to payment userOp. To prevent adding the init code / authList
    // in developer defined userOps, this field must be true
    isInitDataProcessed = true
  }

  if (!paymentInfo) throw new Error("Failed to generate payment info")

  return { paymentInfo, isInitDataProcessed }
}

const prepareUserOps = async (
  account: MultichainSmartAccount,
  instructions: Instruction[],
  isCleanUpUserOps = false,
  moduleAddress?: Address
) => {
  return await Promise.all(
    instructions.map((userOp) => {
      const deployment = account.deploymentOn(userOp.chainId, true)
      const accountAddress = account.addressOn(userOp.chainId, true)

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

      // This is the place to set the short encoding flag
      // It can be based on the module address or on the instruction type
      // Currently instructions are for the userOps only
      // That's why this function is called prepareUserOps
      // However it is possible that a superTxn consists not of the userOps only
      // So for example signed EIP-712 data structs or
      // ERC-7683 Cross-chain intents can be included in the superTxn
      // And this function will have to convert them out of instructions
      // Such 'off-chain' entities will have to be used with short encoding flag
      // For we just set it to false for now
      const shortEncoding = false

      return Promise.all([
        callsPromise,
        deployment.getNonceWithKey(accountAddress, { moduleAddress }),
        deployment.isDeployed(),
        deployment.getInitCode(),
        deployment.address,
        userOp.calls
          .map((uo) => uo?.gasLimit ?? LARGE_DEFAULT_GAS_LIMIT)
          .reduce((curr, acc) => curr + acc, 0n)
          .toString(),
        userOp.chainId.toString(),
        isCleanUpUserOps,
        deployment,
        shortEncoding
      ])
    })
  )
}

export const userOp = (userOpIndex: number) => {
  if (userOpIndex <= 0)
    throw new Error("UserOp index should be greater than zero")

  // During the userop building, the payment user ops is not available. But the slot 1 is always reserved for payment userop
  // as standard practise. Hence, the userOp will indirectly implies this by -1 which yields the first userop defined by devs
  return userOpIndex - 1
}

const prepareCleanUpUserOps = async (
  account: MultichainSmartAccount,
  userOpsNonceInfo: NonceInfo[],
  cleanUps: CleanUp[],
  moduleAddress?: Address
) => {
  const cleanUpInstructions = await Promise.all(
    cleanUps.map(async (cleanUp) => {
      let amount: bigint | RuntimeValue = cleanUp.amount ?? 0n

      // If there is no amount specified ? Runtime amount will be cleaned up by default
      if (amount === 0n) {
        amount = runtimeERC20BalanceOf({
          targetAddress: account.addressOn(cleanUp.chainId, true),
          tokenAddress: cleanUp.tokenAddress,
          constraints: [greaterThanOrEqualTo(1n)] // Cleanup will only happen if there is atleast 1 wei
        })
      }

      const [cleanUpTransferInstruction] = await buildComposable(
        { account: account, currentInstructions: [] },
        {
          type: "transfer",
          data: {
            recipient: cleanUp.recipientAddress,
            tokenAddress: cleanUp.tokenAddress,
            amount,
            chainId: cleanUp.chainId,
            ...(cleanUp.gasLimit ? { gasLimit: cleanUp.gasLimit } : {})
          }
        }
      )

      const nonceDependencies: RuntimeValue[] = []

      if (cleanUp.dependsOn && cleanUp.dependsOn.length > 0) {
        for (const userOpIndex of cleanUp.dependsOn) {
          const userOpNonceInfo = userOpsNonceInfo[userOpIndex]
          if (!userOpNonceInfo)
            throw new Error(
              "Invalid UserOp dependency, please check the dependsOn configuration"
            )

          const { nonce, nonceKey } = userOpNonceInfo

          const nonceOf = runtimeNonceOf({
            smartAccountAddress: account.addressOn(cleanUp.chainId, true),
            nonceKey: nonceKey,
            constraints: [greaterThanOrEqualTo(nonce + 1n)]
          })

          nonceDependencies.push(nonceOf)
        }
      } else {
        const lastUserOp = userOpsNonceInfo[userOpsNonceInfo.length - 1]
        const { nonce, nonceKey } = lastUserOp

        const nonceOf = runtimeNonceOf({
          smartAccountAddress: account.addressOn(cleanUp.chainId, true),
          nonceKey: nonceKey,
          constraints: [greaterThanOrEqualTo(nonce + 1n)]
        })

        nonceDependencies.push(nonceOf)
      }

      const nonceDependencyInputParams = nonceDependencies.flatMap(
        (dep) => dep.inputParams
      )

      cleanUpTransferInstruction.calls = (
        cleanUpTransferInstruction.calls as ComposableCall[]
      ).map((call) => {
        call.inputParams.push(...nonceDependencyInputParams)
        return call
      })

      return cleanUpTransferInstruction
    })
  )

  const cleanUpUserOps = await prepareUserOps(
    account,
    cleanUpInstructions,
    true,
    moduleAddress
  )

  return cleanUpUserOps
}

// ============ resolve verification gas limit functions ============
/**
 * Parameters for the resolveVerificationGasLimit function
 * @param moduleAddress - The address of the module
 * @param index - The index of the userOp during the userOps completion process
 * @param sponsorship - Whether the superTxn is sponsored
 */
export type resolveVerificationGasLimitParams = {
  moduleAddress?: Address
  sponsorship: boolean
  index: number
}

/**
 * Returns the verification gas limit for the userOp, to be spread
 */
export type verificationGasLimitPayload = {
  verificationGasLimit: string
}

/**
 * Returns the verification gas limit for the userOp
 * @param parameters - The parameters for the resolveVerificationGasLimit function
 * @returns The verification gas limit for the userOp/paymentInfo
 * returns undefined if there's no special gas limit required for a given case
 * 'undefined' means the node will apply the default verification gas limit
 */
const resolveVerificationGasLimit = (
  parameters: resolveVerificationGasLimitParams & {
    paymentChainId: string
    currentChainId: string
  }
): verificationGasLimitPayload | undefined => {
  const { moduleAddress, sponsorship, index, paymentChainId, currentChainId } =
    parameters
  if (currentChainId === paymentChainId) {
    return resolveVerificationGasLimitForPaymentChain({
      moduleAddress,
      sponsorship,
      index
    })
  }
  return resolveVerificationGasLimitForNonPaymentChain({
    moduleAddress,
    index
  })
}

/**
 * Returns the verification gas limit for the userOp on the payment chain
 * @param parameters - The parameters for the resolveVerificationGasLimit function
 * @returns The verification gas limit for the userOp
 * returns undefined if there's no special gas limit required for a given case
 * 'undefined' means the node will apply the default verification gas limit
 */
const resolveVerificationGasLimitForPaymentChain = (
  parameters: resolveVerificationGasLimitParams
): verificationGasLimitPayload | undefined => {
  const { moduleAddress, sponsorship, index } = parameters
  // if module address is not provided, the default verification gas limit will be applied
  if (!moduleAddress) {
    return undefined
  }
  if (addressEquals(moduleAddress, SMART_SESSIONS_ADDRESS)) {
    if (sponsorship) {
      if (index === 0) {
        // return increased verification gas limit for the first userOp
        // as it this userOp will be enabling the permission => requires more gas
        return { verificationGasLimit: "1000000" }
      }
    }
    // return slighly increased verification gas limit
    // for USE session userOps
    return { verificationGasLimit: "250000" }
  }
  return undefined
}

/**
 * Returns the verification gas limit for the userOp on a non-payment chain
 * @param parameters - The parameters for the resolveVerificationGasLimit function
 * @returns The verification gas limit for the userOp
 * returns undefined if there's no special gas limit required for a given case
 * 'undefined' means the node will apply the default verification gas limit
 */
const resolveVerificationGasLimitForNonPaymentChain = (
  parameters: Omit<resolveVerificationGasLimitParams, "sponsorship">
): verificationGasLimitPayload | undefined => {
  const { moduleAddress, index } = parameters
  // if module address is not provided, the default verification gas limit will be applied
  if (!moduleAddress) {
    return undefined
  }
  if (addressEquals(moduleAddress, SMART_SESSIONS_ADDRESS)) {
    if (index === 0) {
      // return increased verification gas limit for payment userOp
      // in a non-sponsored superTxn
      return { verificationGasLimit: "1000000" }
    }
    // for all other userOps, return USE session verification gas limit
    return { verificationGasLimit: "250000" }
  }
  return undefined
}

/**
 * Returns the verification gas limit for the payment userOp
 * @param parameters - The parameters for the resolveVerificationGasLimit function
 * @returns The verification gas limit for the payment userOp
 * returns undefined if there's no special gas limit required for a given case
 * 'undefined' means the node will apply the default verification gas limit
 */
const resolvePaymentUserOpVerificationGasLimit = (
  parameters: Omit<resolveVerificationGasLimitParams, "index">
): verificationGasLimitPayload | undefined => {
  const { moduleAddress, sponsorship } = parameters
  // if module address is not provided, the default verification gas limit will be applied
  if (!moduleAddress) {
    return undefined
  }
  if (addressEquals(moduleAddress, SMART_SESSIONS_ADDRESS)) {
    if (!sponsorship) {
      // return increased verification gas limit for payment userOp
      // in a non-sponsored superTxn
      return { verificationGasLimit: "1000000" }
    }
    // if it is sponsorship, the payment userOp won't even use Smart Sessions Module
    // so doesn't need any custom verification gas limit
  }
  return undefined
}

// ====================================================

export default getQuote
