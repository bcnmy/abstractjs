import { Address, Chain } from "viem";
import { MultichainSmartAccount } from "../../account-vendors";
import { MultichainAddressMapping } from "../../primitives";
import { MeeUserOp } from "../../workflow";
import { UnifiedERC20Balance } from "../contract/getUnifiedERC20Balance";

export type BridgingUserOpParams = {
  fromChain: Chain;
  toChain: Chain;
  multichainAccount: MultichainSmartAccount;
  tokenMapping: MultichainAddressMapping;
  bridgingAmount: bigint;
};

export type MultichainBridgingParams = {
  toChain: Chain;
  unifiedBalance: UnifiedERC20Balance;
  multichainAccount: MultichainSmartAccount;
  amount: bigint;
};

export type BridgingPluginResult = {
  userOp: MeeUserOp;
  receivedAtDestination?: bigint;
  bridgingDurationExpectedMs?: number;
};

export type BridgingPlugin = {
  encodeBridgeUserOp: (
    params: BridgingUserOpParams
  ) => Promise<BridgingPluginResult>;
};

// Single bridge operation result
export type BridgingInstruction = {
  userOp: MeeUserOp;
  receivedAtDestination?: bigint;
  bridgingDurationExpectedMs?: number;
};

// Complete set of bridging instructions and final outcome
export type BridgingInstructions = {
  instructions: BridgingInstruction[];
  totalAvailableOnDestination: bigint;
};

// Parameters when paying tx fee with bridged token
type BridgingWithTokenFeeParams = MultichainBridgingParams & {
  isTxFeePaidWithTokenBeingBridged: true;
  txFeeChainId: number;
  txFeeAmount: bigint;
  bridgingPlugins: BridgingPlugin[];
};

// Parameters when not paying tx fee with bridged token
type BridgingWithoutTokenFeeParams = MultichainBridgingParams & {
  isTxFeePaidWithTokenBeingBridged?: false;
  bridgingPlugins: BridgingPlugin[];
};

export type BridgingParameters =
  | BridgingWithTokenFeeParams
  | BridgingWithoutTokenFeeParams;

// Parameters for a single bridge query
type QueryBridgeParams = {
  fromChain: Chain;
  toChain: Chain;
  plugin: BridgingPlugin;
  amount: bigint;
  multichainAccount: MultichainSmartAccount;
  tokenMapping: MultichainAddressMapping;
};

// Result of a bridge query including chain info
type BridgeQueryResult = {
  fromChainId: number;
  amount: bigint;
  receivedAtDestination: bigint;
  plugin: BridgingPlugin;
  userOp: MeeUserOp;
  bridgingDurationExpectedMs?: number;
};

/**
 * Queries a single bridge for transfer details
 */
const queryBridge = async ({
  fromChain,
  toChain,
  plugin,
  amount,
  multichainAccount,
  tokenMapping,
}: QueryBridgeParams): Promise<BridgeQueryResult | null> => {
  try {
    const result = await plugin.encodeBridgeUserOp({
      fromChain,
      toChain,
      multichainAccount,
      tokenMapping,
      bridgingAmount: amount,
    });

    // Skip if bridge doesn't provide received amount
    if (!result.receivedAtDestination) return null;

    return {
      fromChainId: fromChain.id,
      amount,
      receivedAtDestination: result.receivedAtDestination,
      plugin,
      userOp: result.userOp,
      bridgingDurationExpectedMs: result.bridgingDurationExpectedMs,
    };
  } catch (err) {
    console.error(
      `Error querying bridge from chain ${fromChain.id}: ` +
        `${err instanceof Error ? err.message : "Unknown error"}`
    );
    return null;
  }
};

export const buildMultichainBridgingInstructions = async (
  params: BridgingParameters
): Promise<BridgingInstructions> => {
  const {
    amount: targetAmount,
    toChain,
    unifiedBalance,
    multichainAccount,
    bridgingPlugins,
  } = params;

  // Create token address mapping
  const tokenMapping: MultichainAddressMapping = {
    on: (chainId: number) =>
      unifiedBalance.token.deployments.get(chainId) || "0x",
    deployments: Array.from(
      unifiedBalance.token.deployments.entries(),
      ([chainId, address]) => ({
        chainId,
        address,
      })
    ),
  };

  // Get current balance on destination chain
  const destinationBalance =
    unifiedBalance.breakdown.find((b) => b.chainId === toChain.id)?.balance ||
    0n;

  // If we have enough on destination, no bridging needed
  if (destinationBalance >= targetAmount) {
    return {
      instructions: [],
      totalAvailableOnDestination: destinationBalance,
    };
  }

  // Calculate how much we need to bridge
  const amountToBridge = targetAmount - destinationBalance;

  // Get available balances from source chains
  const sourceBalances = unifiedBalance.breakdown
    .filter((balance) => balance.chainId !== toChain.id)
    .map((balance) => {
      // If this is the fee payment chain, adjust available balance
      const isFeeChain =
        params.isTxFeePaidWithTokenBeingBridged &&
        params.txFeeChainId === balance.chainId;

      const availableBalance =
        isFeeChain && "txFeeAmount" in params
          ? balance.balance > params.txFeeAmount
            ? balance.balance - params.txFeeAmount
            : 0n
          : balance.balance;

      return {
        chainId: balance.chainId,
        balance: availableBalance,
      };
    })
    .filter((balance) => balance.balance > 0n);

  // Get chain configurations
  const chains = Object.fromEntries(
    multichainAccount.deployments.map((deployment) => {
      const chain = deployment.client.chain;
      if (!chain) {
        throw new Error(
          `Client not configured with chain for deployment at ${deployment.address}`
        );
      }
      return [chain.id, chain] as const;
    })
  );

  // Query all possible routes
  const bridgeQueries = sourceBalances.flatMap((source) => {
    const fromChain = chains[source.chainId];
    if (!fromChain) return [];

    return bridgingPlugins.map((plugin) =>
      queryBridge({
        fromChain,
        toChain,
        plugin,
        amount: source.balance,
        multichainAccount,
        tokenMapping,
      })
    );
  });

  const bridgeResults = (await Promise.all(bridgeQueries))
    .filter((result): result is BridgeQueryResult => result !== null)
    // Sort by received amount relative to sent amount
    .sort(
      (a, b) =>
        Number((b.receivedAtDestination * 10000n) / b.amount) -
        Number((a.receivedAtDestination * 10000n) / a.amount)
    );

  // Build instructions by taking from best routes until we have enough
  const instructions: BridgingInstruction[] = [];
  let totalBridged = 0n;
  let remainingNeeded = amountToBridge;

  for (const result of bridgeResults) {
    if (remainingNeeded <= 0n) break;

    const amountToTake =
      result.amount >= remainingNeeded ? remainingNeeded : result.amount;

    // Recalculate received amount based on portion taken
    const receivedFromRoute =
      (result.receivedAtDestination * amountToTake) / result.amount;

    instructions.push({
      userOp: result.userOp,
      receivedAtDestination: receivedFromRoute,
      bridgingDurationExpectedMs: result.bridgingDurationExpectedMs,
    });

    totalBridged += receivedFromRoute;
    remainingNeeded -= amountToTake;
  }

  // Check if we got enough
  if (remainingNeeded > 0n) {
    throw new Error(
      `Insufficient balance for bridging. ` +
        `Need ${targetAmount.toString()}, ` +
        `can only bridge ${totalBridged.toString()} ` +
        `(${remainingNeeded.toString()} more needed)`
    );
  }

  return {
    instructions,
    totalAvailableOnDestination: destinationBalance + totalBridged,
  };
};
