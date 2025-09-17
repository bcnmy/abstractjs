import type { Address } from "viem"

export type AmountType = bigint | "RUNTIME_VALUE"

export type TokenType = Address | "RUNTIME_VALUE"

// Known Transaction Metadata
export interface TokenTransferMetadata {
  type: "TRANSFER" // 'TRANSFER'
  tokenAddress: TokenType // Address of the token being transferred
  decimals?: number // Decimals of the token being transferred
  fromAddress: Address // Sender of the tokens
  toAddress: Address // Recipient of the tokens
  amount: AmountType // Amount transferred (raw value as string)
  chainId: number // Chain ID (e.g., 1 for Ethereum, 137 for Polygon)
}

export interface ApproveMetadata {
  type: "APPROVE" // 'APPROVE'
  tokenAddress: TokenType // Token being approved
  decimals?: number // Decimals of the token being approved
  fromAddress: Address // Owner (approver)
  toAddress: Address // Spender being approved
  amount: AmountType // Approved amount
  chainId: number
}

export interface WithdrawMetadata {
  type: "WITHDRAW" // 'WITHDRAW'
  tokenAddress: TokenType // Token being withdrawn
  decimals?: number // Decimals of the token being withdrawn
  fromAddress: Address // Protocol or vault address
  toAddress: Address // User receiving the withdrawn tokens
  amount: AmountType // Withdraw amount
  chainId: number
}

// Bridge Transaction Metadata
export interface BridgeMetadata {
  type: "BRIDGE" // 'BRIDGE'
  fromAddress: Address // User initiating the bridge
  toAddress: Address // Recipient on destination chain
  fromTokenAddress: TokenType // Token being bridged (on source chain)
  fromTokenDecimals?: number // Decimals of the token being bridged (on source chain)
  toTokenAddress: TokenType // Token received (on destination chain)
  toTokenDecimals?: number // Decimals of the token received (on destination chain)
  fromChainId: number // Source chain ID
  toChainId: number // Destination chain ID
  amount: AmountType // Bridge amount
  protocolNames?: string[] // Optional: Bridge protocol(s) used (e.g., ['Hop', 'Stargate'])
}

// Swap Transaction Metadata
export interface SwapMetadata {
  type: "SWAP" // 'SWAP'
  fromTokenAddress: TokenType // Input token being swapped
  fromTokenDecimals?: number // Decimals of the input token
  toTokenAddress: TokenType // Output token received
  toTokenDecimals?: number // Decimals of the output token
  fromAddress: Address // User initiating the swap
  toAddress: Address // Protocol contract facilitating the swap
  chainId: number
  protocolNames?: string[] // DEXes used in the swap (e.g., ['Uniswap', '1inch'])
}

// Liquidity Transaction Metadata
export interface AddLiquidityMetadata {
  type: "ADD_LIQUIDITY" // 'ADD_LIQUIDITY'
  tokenAddress: TokenType // LP token or underlying token (can vary)
  decimals?: number // Decimals of the LP token or underlying token
  fromAddress: Address // User adding liquidity
  toAddress: Address // Pool or protocol receiving the liquidity
  amount: AmountType // Total amount deposited
  chainId: number
  protocolNames?: string[] // Protocols involved (e.g., ['Uniswap'])
}

export interface RemoveLiquidityMetadata {
  type: "REMOVE_LIQUIDITY" // 'REMOVE_LIQUIDITY'
  tokenAddress: TokenType // LP token or underlying token
  decimals?: number // Decimals of the LP token or underlying token
  fromAddress: Address // Pool or protocol returning funds
  toAddress: Address // User removing liquidity
  amount: AmountType // Amount withdrawn
  chainId: number
  protocolNames?: string[] // Protocols involved
}

// Staking Transaction Metadata
export interface StakeMetadata {
  type: "STAKE" // 'STAKE'
  tokenAddress: TokenType // Token being staked
  decimals?: number // Decimals of the token being staked
  fromAddress: Address // User staking
  toAddress: Address // Staking contract or vault
  amount: AmountType
  chainId: number
  protocolNames?: string[] // Optional: Protocols like ['Lido']
}

export interface UnstakeMetadata {
  type: "UNSTAKE" // 'UNSTAKE'
  tokenAddress: TokenType // Token being unstaked
  decimals?: number // Decimals of the token being unstaked
  fromAddress: Address // Protocol or vault
  toAddress: Address // User receiving tokens
  amount: AmountType
  chainId: number
  protocolNames?: string[]
}

export interface LendMetadata {
  type: "LEND" // 'LEND'
  tokenAddress: TokenType // Supplied token (e.g., USDC)
  decimals?: number // Decimals of the supplied token
  fromAddress: Address // User supplying the token
  toAddress: Address // Protocol contract
  amount: AmountType // Supplied amount
  chainId: number
  protocolNames?: string[] // ['Aave', 'Compound', 'Morpho']
}

export interface BorrowMetadata {
  type: "BORROW" // 'BORROW'
  tokenAddress: TokenType // Borrowed token (e.g., DAI)
  decimals?: number // Decimals of the borrowed token
  fromAddress: Address // Protocol contract (source of funds)
  toAddress: Address // User receiving the borrowed token
  amount: AmountType // Borrowed amount
  chainId: number
  protocolNames?: string[] // ['Aave', 'Compound', 'Morpho']
}

// Custom Transaction Metadata
export interface CustomMetadata {
  type: "CUSTOM" // 'CUSTOM'
  description: string // Supply 10 USDC to Pendle / anything
  chainId: number
}

// Global union type for all supported transaction metadata types
export type InstructionMetadata =
  | TokenTransferMetadata
  | ApproveMetadata
  | WithdrawMetadata
  | BridgeMetadata
  | SwapMetadata
  | AddLiquidityMetadata
  | RemoveLiquidityMetadata
  | StakeMetadata
  | UnstakeMetadata
  | LendMetadata
  | BorrowMetadata
  | CustomMetadata

export type InstructionMetadataType = InstructionMetadata["type"]
