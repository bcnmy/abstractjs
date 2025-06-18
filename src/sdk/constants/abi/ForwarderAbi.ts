export const ForwarderAbi = [
  { inputs: [], name: "ForwardFailed", type: "error" },
  { inputs: [], name: "UseForwardFunction", type: "error" },
  { inputs: [], name: "ZeroAddress", type: "error" },
  { stateMutability: "payable", type: "fallback" },
  {
    inputs: [{ internalType: "address", name: "destination", type: "address" }],
    name: "forward",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  { stateMutability: "payable", type: "receive" }
] as const
