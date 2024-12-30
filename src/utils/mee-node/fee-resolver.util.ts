import type { Address } from "viem";
import {
  optimism,
  polygon,
  arbitrum,
  avalanche,
  scroll,
  base,
} from "viem/chains";

export type SupportedFeeChainId =
  | typeof optimism.id
  | typeof polygon.id
  | typeof arbitrum.id
  | typeof avalanche.id
  | typeof scroll.id
  | typeof base.id;

export type FeeToken =
  | "USDC"
  | "USDT"
  | "ETH"
  | "MATIC"
  | "LINK"
  | "WETH"
  | "WMATIC"
  | "WAVAX"
  | "stMATIC"
  | "wstETH"
  | "axlUSDC";

interface TokenInfo {
  name: string;
  address: Address;
  symbol: string;
  decimals: number;
  permitEnabled: boolean;
}

const chainTokens: Record<SupportedFeeChainId, Record<string, TokenInfo>> = {
  [optimism.id]: {
    ETH: {
      name: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      permitEnabled: false,
    },
    WETH: {
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
      permitEnabled: false,
    },
    LINK: {
      name: "ChainLink Token",
      address: "0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6",
      symbol: "LINK",
      decimals: 18,
      permitEnabled: false,
    },
    USDC: {
      name: "USD Coin",
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      symbol: "USDC",
      decimals: 6,
      permitEnabled: true,
    },
    USDT: {
      name: "Tether USD",
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      symbol: "USDT",
      decimals: 6,
      permitEnabled: false,
    },
    wstETH: {
      name: "Wrapped liquid staked Ether 2.0",
      address: "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb",
      symbol: "wstETH",
      decimals: 18,
      permitEnabled: false,
    },
  },
  [polygon.id]: {
    MATIC: {
      name: "MATIC",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "MATIC",
      decimals: 18,
      permitEnabled: false,
    },
    WMATIC: {
      name: "Wrapped Matic",
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      symbol: "WMATIC",
      decimals: 18,
      permitEnabled: false,
    },
    LINK: {
      name: "ChainLink Token",
      address: "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
      symbol: "LINK",
      decimals: 18,
      permitEnabled: false,
    },
    USDC: {
      name: "USDC",
      address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
      symbol: "USDC",
      decimals: 6,
      permitEnabled: true,
    },
    USDT: {
      name: "Tether USD",
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      symbol: "USDT",
      decimals: 6,
      permitEnabled: false,
    },
    stMATIC: {
      name: "Staked Matic",
      address: "0x3a58a54c066fdc0f2d55fc9c89f0415c92ebf3c4",
      symbol: "stMATIC",
      decimals: 18,
      permitEnabled: false,
    },
  },
  [arbitrum.id]: {
    ETH: {
      name: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      permitEnabled: false,
    },
    WETH: {
      name: "Wrapped Ether",
      address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      symbol: "WETH",
      decimals: 18,
      permitEnabled: false,
    },
    LINK: {
      name: "ChainLink Token",
      address: "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
      symbol: "LINK",
      decimals: 18,
      permitEnabled: true,
    },
    USDC: {
      name: "USD Coin",
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      symbol: "USDC",
      decimals: 6,
      permitEnabled: true,
    },
    USDT: {
      name: "Tether USD",
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      symbol: "USDT",
      decimals: 6,
      permitEnabled: true,
    },
    wstETH: {
      name: "Wrapped liquid staked Ether 2.0",
      address: "0x5979D7b546E38E414F7E9822514be443A4800529",
      symbol: "wstETH",
      decimals: 18,
      permitEnabled: false,
    },
  },
  [avalanche.id]: {
    AVAX: {
      name: "AVAX",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "AVAX",
      decimals: 18,
      permitEnabled: false,
    },
    WAVAX: {
      name: "Wrapped AVAX",
      address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      symbol: "WAVAX",
      decimals: 18,
      permitEnabled: false,
    },
    LINK: {
      name: "ChainLink Token",
      address: "0x5947BB275c521040051D82396192181b413227A3",
      symbol: "LINK",
      decimals: 18,
      permitEnabled: false,
    },
    USDC: {
      name: "USD Coin",
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      symbol: "USDC",
      decimals: 6,
      permitEnabled: false,
    },
    USDT: {
      name: "Tether USD",
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      symbol: "USDT",
      decimals: 6,
      permitEnabled: true,
    },
  },
  [scroll.id]: {
    ETH: {
      name: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      permitEnabled: false,
    },
    WETH: {
      name: "Wrapped Ether",
      address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
      symbol: "WETH",
      decimals: 18,
      permitEnabled: false,
    },
    LINK: {
      name: "ChainLink Token",
      address: "0x548C6944cba02B9D1C0570102c89de64D258d3Ac",
      symbol: "LINK",
      decimals: 18,
      permitEnabled: false,
    },
    USDC: {
      name: "USD Coin",
      address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4",
      symbol: "USDC",
      decimals: 6,
      permitEnabled: true,
    },
    USDT: {
      name: "Tether USD",
      address: "0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df",
      symbol: "USDT",
      decimals: 6,
      permitEnabled: true,
    },
    wstETH: {
      name: "Wrapped liquid staked Ether 2.0",
      address: "0xf610A9dfB7C89644979b4A0f27063E9e7d7Cda32",
      symbol: "wstETH",
      decimals: 18,
      permitEnabled: true,
    },
  },
  [base.id]: {
    ETH: {
      name: "ETH",
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      decimals: 18,
      permitEnabled: false,
    },
    WETH: {
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      decimals: 18,
      permitEnabled: false,
    },
    LINK: {
      name: "ChainLink Token",
      address: "0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8c6e196",
      symbol: "LINK",
      decimals: 18,
      permitEnabled: false,
    },
    USDC: {
      name: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      decimals: 6,
      permitEnabled: true,
    },
    axlUSDC: {
      name: "USDC (Axelar Wrapped)",
      address: "0xEB466342C4d449BC9f53A865D5Cb90586f405215",
      symbol: "axlUSDC",
      decimals: 6,
      permitEnabled: true,
    },
    wstETH: {
      name: "Wrapped liquid staked Ether 2.0",
      address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
      symbol: "wstETH",
      decimals: 18,
      permitEnabled: false,
    },
  },
};

export function resolveFeeToken(
  chainId: SupportedFeeChainId,
  token: FeeToken
) {
  const chainTokenList = chainTokens[chainId];
  if (!chainTokenList) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const tokenInfo = chainTokenList[token];
  if (!tokenInfo) {
    throw new Error(`Unsupported token ${token} for chain ID ${chainId}`);
  }

  return {
    address: tokenInfo.address,
    chainId: chainId
  };
}
