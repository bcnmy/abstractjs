export const CounterAbi = [
  {
    type: "function",
    name: "decrementNumber",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getNumber",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "incrementNumber",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "revertOperation",
    inputs: [],
    outputs: [],
    stateMutability: "pure"
  }
] as const
