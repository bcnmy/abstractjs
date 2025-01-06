import type { Address, Hex } from "viem"
import type { NonEmptyArray } from "./utils/types/util.type"

type AbstractCallMandatoryFields = {
  to: Address
  gasLimit: bigint
}

export type AbstractCall =
  | (AbstractCallMandatoryFields & { value: bigint; data?: Hex })
  | (AbstractCallMandatoryFields & { value?: bigint; data: Hex })
  | (AbstractCallMandatoryFields & { value: bigint; data: Hex })

export type Instruction = MeeUserOp

export function buildCall(call: AbstractCall) {
  return call
}

/**
 * Represents a user operation that hasn't yet been assigned to a specific blockchain.
 * This is a chain-agnostic representation of a user operation that contains only the
 * transaction calls, waiting to be bound to one or more specific chains.
 */
export class PartialMeeUserOp {
  /** Array of abstract calls that must contain at least one element */
  calls: NonEmptyArray<AbstractCall>

  /**
   * Creates a new chain-agnostic user operation.
   * @param transactions - Non-empty array of abstract calls to be executed
   */
  constructor(transactions: NonEmptyArray<AbstractCall>) {
    this.calls = transactions
  }

  /**
   * Binds the user operation to one or more specific chains by assigning chain ID(s).
   * This transforms the partial (chain-agnostic) user operation into a complete user operation.
   * @template T - Type parameter that can be either a number or a non-empty array of numbers
   * @param chainId - Single chain ID or array of chain IDs to bind this operation to
   * @returns If chainId is an array, returns an array of complete AbstractUserOp objects, one for each chain ID.
   *          If chainId is a single number, returns a single complete AbstractUserOp object.
   * @example
   * // Bind to a single chain
   * const singleOp = partialOp.on(1);
   *
   * // Bind to multiple chains
   * const multiOp = partialOp.on([1, 2, 3]);
   */
  on<T extends number | NonEmptyArray<number>>(
    chainId: T
  ): T extends NonEmptyArray<number> ? NonEmptyArray<MeeUserOp> : MeeUserOp {
    if (Array.isArray(chainId)) {
      return chainId.map((id) => ({
        calls: this.calls,
        chainId: id
      })) as T extends NonEmptyArray<number>
        ? NonEmptyArray<MeeUserOp>
        : MeeUserOp
    }
    return {
      calls: this.calls,
      chainId: chainId
    } as T extends NonEmptyArray<number> ? NonEmptyArray<MeeUserOp> : MeeUserOp
  }
}

export type MeeUserOp = {
  calls: NonEmptyArray<AbstractCall>
  chainId: number
}

export type FeeTokenInfo = {
  address: Address
  chainId: number
}

export type Supertransaction = {
  instructions: NonEmptyArray<Instruction>
  feeToken: FeeTokenInfo
}

/**
 * Builds a user operation from calls and an optional chain ID.
 * @template T - Object type containing calls and optional chainId properties
 * @param params - Configuration object for building the user operation
 * @param params.calls - Single call or non-empty array of abstract calls to be executed
 * @param params.chainId - Optional chain ID where the operation should be executed
 * @returns If chainId is provided, returns a complete AbstractUserOp bound to that chain.
 *          If chainId is omitted, returns a PartialAbstractUserOp that can be bound to chains later.
 * @example
 * // Build a complete user operation bound to Optimism
 * const boundOp = buildAbstractUserOp({
 *   calls: myCall,
 *   chainId: optimism.id
 * });
 *
 * // Build a partial user operation to bind to chains later
 * const partialOp = buildAbstractUserOp({
 *   calls: myCall
 * });
 */
export function buildMeeUserOp<
  T extends {
    calls: NonEmptyArray<AbstractCall> | AbstractCall
    chainId?: number
  }
>(params: T): T extends { chainId: number } ? MeeUserOp : PartialMeeUserOp {
  const transactions: NonEmptyArray<AbstractCall> = Array.isArray(params.calls)
    ? params.calls
    : [params.calls]

  if ("chainId" in params && params.chainId !== undefined) {
    return {
      calls: transactions,
      chainId: params.chainId
    } as T extends { chainId: number } ? MeeUserOp : PartialMeeUserOp
  }
  return new PartialMeeUserOp(transactions) as T extends {
    chainId: number
  }
    ? MeeUserOp
    : PartialMeeUserOp
}
