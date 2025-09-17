import type { Address } from "viem"

export type MetadataAmountType = bigint | "RUNTIME_VALUE"

export type MetadataAddressType = Address | "RUNTIME_VALUE"

// Known Transaction Metadata
export interface TokenTransferMetadata {
  type: "TRANSFER" // 'TRANSFER'
  tokenAddress: MetadataAddressType // Address of the token being transferred
  decimals?: number // Decimals of the token being transferred
  fromAddress: MetadataAddressType // Sender of the tokens
  toAddress: MetadataAddressType // Recipient of the tokens
  amount: MetadataAmountType // Amount transferred (raw value as string)
  chainId: number // Chain ID (e.g., 1 for Ethereum, 137 for Polygon)
}

export interface ApproveMetadata {
  type: "APPROVE" // 'APPROVE'
  tokenAddress: MetadataAddressType // Token being approved
  decimals?: number // Decimals of the token being approved
  fromAddress: MetadataAddressType // Owner (approver)
  toAddress: MetadataAddressType // Spender being approved
  amount: MetadataAmountType // Approved amount
  chainId: number
}

export interface WithdrawMetadata {
  type: "WITHDRAW" // 'WITHDRAW'
  tokenAddress: MetadataAddressType // Token being withdrawn
  decimals?: number // Decimals of the token being withdrawn
  fromAddress: MetadataAddressType // Protocol or vault address
  toAddress: MetadataAddressType // User receiving the withdrawn tokens
  amount: MetadataAmountType // Withdraw amount
  chainId: number
}

// Bridge Transaction Metadata
export interface BridgeMetadata {
  type: "BRIDGE" // 'BRIDGE'
  fromAddress: MetadataAddressType // User initiating the bridge
  toAddress: MetadataAddressType // Recipient on destination chain
  fromTokenAddress: MetadataAddressType // Token being bridged (on source chain)
  fromTokenDecimals?: number // Decimals of the token being bridged (on source chain)
  toTokenAddress: MetadataAddressType // Token received (on destination chain)
  toTokenDecimals?: number // Decimals of the token received (on destination chain)
  fromChainId: number // Source chain ID
  toChainId: number // Destination chain ID
  amount: MetadataAmountType // Bridge amount
  protocolNames?: string[] // Optional: Bridge protocol(s) used (e.g., ['Hop', 'Stargate'])
}

// Swap Transaction Metadata
export interface SwapMetadata {
  type: "SWAP" // 'SWAP'
  fromTokenAddress: MetadataAddressType // Input token being swapped
  fromTokenDecimals?: number // Decimals of the input token
  toTokenAddress: MetadataAddressType // Output token received
  toTokenDecimals?: number // Decimals of the output token
  fromAddress: MetadataAddressType // User initiating the swap
  toAddress: MetadataAddressType // Protocol contract facilitating the swap
  chainId: number
  protocolNames?: string[] // DEXes used in the swap (e.g., ['Uniswap', '1inch'])
}

// Liquidity Transaction Metadata
export interface AddLiquidityMetadata {
  type: "ADD_LIQUIDITY" // 'ADD_LIQUIDITY'
  tokenAddress: MetadataAddressType // LP token or underlying token (can vary)
  decimals?: number // Decimals of the LP token or underlying token
  fromAddress: MetadataAddressType // User adding liquidity
  toAddress: MetadataAddressType // Pool or protocol receiving the liquidity
  amount: MetadataAmountType // Total amount deposited
  chainId: number
  protocolNames?: string[] // Protocols involved (e.g., ['Uniswap'])
}

export interface RemoveLiquidityMetadata {
  type: "REMOVE_LIQUIDITY" // 'REMOVE_LIQUIDITY'
  tokenAddress: MetadataAddressType // LP token or underlying token
  decimals?: number // Decimals of the LP token or underlying token
  fromAddress: MetadataAddressType // Pool or protocol returning funds
  toAddress: MetadataAddressType // User removing liquidity
  amount: MetadataAmountType // Amount withdrawn
  chainId: number
  protocolNames?: string[] // Protocols involved
}

// Staking Transaction Metadata
export interface StakeMetadata {
  type: "STAKE" // 'STAKE'
  tokenAddress: MetadataAddressType // Token being staked
  decimals?: number // Decimals of the token being staked
  fromAddress: MetadataAddressType // User staking
  toAddress: MetadataAddressType // Staking contract or vault
  amount: MetadataAmountType
  chainId: number
  protocolNames?: string[] // Optional: Protocols like ['Lido']
}

export interface UnstakeMetadata {
  type: "UNSTAKE" // 'UNSTAKE'
  tokenAddress: MetadataAddressType // Token being unstaked
  decimals?: number // Decimals of the token being unstaked
  fromAddress: MetadataAddressType // Protocol or vault
  toAddress: MetadataAddressType // User receiving tokens
  amount: MetadataAmountType
  chainId: number
  protocolNames?: string[]
}

export interface LendMetadata {
  type: "LEND" // 'LEND'
  tokenAddress: MetadataAddressType // Supplied token (e.g., USDC)
  decimals?: number // Decimals of the supplied token
  fromAddress: MetadataAddressType // User supplying the token
  toAddress: MetadataAddressType // Protocol contract
  amount: MetadataAmountType // Supplied amount
  chainId: number
  protocolNames?: string[] // ['Aave', 'Compound', 'Morpho']
}

export interface BorrowMetadata {
  type: "BORROW" // 'BORROW'
  tokenAddress: MetadataAddressType // Borrowed token (e.g., DAI)
  decimals?: number // Decimals of the borrowed token
  fromAddress: MetadataAddressType // Protocol contract (source of funds)
  toAddress: MetadataAddressType // User receiving the borrowed token
  amount: MetadataAmountType // Borrowed amount
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
