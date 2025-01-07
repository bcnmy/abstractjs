import type { Address } from "viem"
import type { MultichainSmartAccount } from "../../account-vendors"
import type {
  MeeCommitedSupertransactionQuote,
  MeeService
} from "../../mee.service"
import type { Instruction, Supertransaction } from "../../workflow"
import {
  type FeeToken,
  type SupportedFeeChainId,
  resolveFeeToken
} from "../mee-node/fee-resolver.util"
import type { NonEmptyArray } from "../types/util.type"

/**
 * Internal state of the supertransaction builder.
 * Collects both immediate instructions and promises of future instructions
 * which will be resolved at finalization time.
 */
export type SupertransactionState = {
  account?: MultichainSmartAccount
  gasToken?: Address
  gasChain?: number
  instructions: Instruction[]
  /** Holds promises of instructions that will be resolved when finalizing */
  pendingInstructions: Promise<Instruction[]>[]
}

/**
 * Main client interface for building supertransactions.
 * Provides a fluent API for configuring and building transactions.
 * All methods (except finalize and getQuote) return a new client instance
 * to maintain immutability.
 */
export type SupertransactionClient = {
  state: SupertransactionState
  injectAccount: (account: MultichainSmartAccount) => SupertransactionClient
  payGasWith: (
    token: FeeToken,
    { on }: { on: SupportedFeeChainId }
  ) => SupertransactionClient
  addInstructions: (
    ...instructions: InstructionInput[]
  ) => SupertransactionClient
  finalize: () => Promise<Supertransaction>
  getQuote: (
    meeService: MeeService
  ) => Promise<MeeCommitedSupertransactionQuote>
  /**
   * Allows third-party extensions to add new functionality to the client.
   * Extensions receive the current client and can return additional methods.
   */
  extend: <T>(extension: Extension<T>) => SupertransactionClient & T
}

/**
 * Extension type for adding new functionality to the client.
 * Extensions can access the client's state and add new methods.
 *
 * @example
 * const myExtension = (client: SupertransactionClient) => ({
 *   newMethod: () => {
 *     // Access client.state and add functionality
 *     return client.addInstructions(...)
 *   }
 * })
 */
type Extension<T> = (client: SupertransactionClient) => T

/**
 * Function type that receives the current transaction state and returns
 * instructions asynchronously. Used for instructions that need access to
 * the transaction context (like balance checks).
 */
export type ContextualInstruction = (
  context: SupertransactionState
) => Promise<Instruction[]>

/**
 * Valid input types for addInstructions.
 * Can be either:
 * - A single instruction
 * - An array of instructions
 * - A function that generates instructions using the transaction context
 */
type InstructionInput = Instruction | Instruction[] | ContextualInstruction

/**
 * Creates a new supertransaction client with the given state.
 * Each method in the client returns a new client instance with updated state
 * to maintain immutability throughout the chain.
 */
function createClient(
  state: SupertransactionState = { instructions: [], pendingInstructions: [] }
): SupertransactionClient {
  const client: SupertransactionClient = {
    state,
    injectAccount: (account) => injectAccount(client, account),
    payGasWith: (token, { on: chainId }) =>
      payGasWith(client, token, { on: chainId }),
    addInstructions: (...instructions) =>
      addInstructions(client, ...instructions),
    finalize: () => finalize(client),
    getQuote: (meeService) => getQuote(client, meeService),
    extend: (extension) =>
      Object.assign(createClient(client.state), extension(client))
  }
  return client
}

// Action Implementations
function injectAccount(
  client: SupertransactionClient,
  account: MultichainSmartAccount
): SupertransactionClient {
  // Maintain pendingInstructions when creating new client
  return createClient({
    ...client.state,
    account,
    pendingInstructions: client.state.pendingInstructions
  })
}

function payGasWith(
  client: SupertransactionClient,
  token: FeeToken,
  { on: chainId }: { on: SupportedFeeChainId }
): SupertransactionClient {
  const resolvedToken = resolveFeeToken(chainId, token)
  return createClient({
    ...client.state,
    gasToken: resolvedToken.address,
    gasChain: chainId,
    pendingInstructions: client.state.pendingInstructions
  })
}

/**
 * Adds instructions to the transaction. Can handle both immediate instructions
 * and contextual instructions (functions that need access to transaction state).
 *
 * Important: This method doesn't immediately resolve promises from contextual
 * instructions. Instead, it collects them to be resolved during finalization.
 * This allows for continuous chaining without awaiting between calls.
 */
function addInstructions(
  client: SupertransactionClient,
  ...instructions: InstructionInput[]
): SupertransactionClient {
  // Convert all inputs to promises - either by wrapping direct instructions
  // or by calling contextual instruction functions
  const pendingInstructions = instructions.map(
    (inst) =>
      typeof inst === "function"
        ? inst(client.state) // Contextual instruction - call with state
        : Promise.resolve(Array.isArray(inst) ? inst : [inst]) // Direct instruction(s)
  )

  return createClient({
    ...client.state,
    pendingInstructions: [
      ...client.state.pendingInstructions,
      ...pendingInstructions
    ]
  })
}

/**
 * Finalizes the transaction by resolving all pending instructions
 * and creating the final transaction object.
 *
 * This is where all promises collected during the build process are
 * finally resolved. Any errors in contextual instructions will surface here.
 */
async function finalize(
  client: SupertransactionClient
): Promise<Supertransaction> {
  const { state } = client
  validateBaseState(state)

  // Resolve all pending instructions in parallel
  const resolvedInstructions = await Promise.all(state.pendingInstructions)
  const allInstructions = [
    ...state.instructions,
    ...resolvedInstructions.flat()
  ]

  if (!allInstructions.length) {
    throw new Error("No instructions provided")
  }

  if (!state.gasToken || !state.gasChain) {
    throw new Error("Gas token configuration missing")
  }

  return {
    instructions: allInstructions as NonEmptyArray<Instruction>,
    feeToken: {
      address: state.gasToken,
      chainId: state.gasChain
    }
  }
}

/**
 * Gets a quote for the transaction from the MEE service.
 * This will finalize the transaction first, resolving all pending instructions.
 */
async function getQuote(
  client: SupertransactionClient,
  meeService: MeeService
): Promise<MeeCommitedSupertransactionQuote> {
  const tx = await finalize(client)

  if (!client.state.account) {
    throw new Error("Account not injected")
  }

  return meeService.getQuote({
    supertransaction: tx,
    account: client.state.account
  })
}

/**
 * Validates the base requirements for a transaction:
 * - Must have an account
 * - Must have gas token configuration
 */
function validateBaseState(state: SupertransactionState) {
  if (!state.account)
    throw new Error(`
    Supertransaction builder: Account not injected!
    When using a Supertransaction builder, you must inject an Account by using the
    withAccount method.  
  `)
  if (!state.gasToken || !state.gasChain)
    throw new Error("Gas token configuration missing")
}

// Public API
/**
 * Creates a new supertransaction builder with a fluent API.
 *
 * @example
 * const tx = await supertransaction()
 *   .injectAccount(mcNexus)
 *   .payGasWith(FeeToken.USDC, { on: optimism.id })
 *   .addInstructions(
 *     requireErc20Balance({
 *       amount: parseUnits('10', 6),
 *       chain: optimism,
 *       token: mUSDC
 *     }),
 *     mUSDC.on(optimism.id).approve({
 *       args: [mcAAVE.addressOn(optimism.id), parseUnits('10', 6)],
 *       gasLimit: 100_000n
 *     })
 *   )
 *   .getQuote(meeService)
 */
export const supertransaction = createClient
