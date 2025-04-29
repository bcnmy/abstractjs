export const FOO_CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "address", name: "a", type: "address" }
    ],
    name: "EmitAddress",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes", name: "b", type: "bytes" }
    ],
    name: "EmitBytes",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "bytes32", name: "b", type: "bytes32" }
    ],
    name: "EmitBytes32",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      {
        components: [
          { internalType: "uint256", name: "aaa", type: "uint256" },
          { internalType: "address", name: "bbb", type: "address" },
          { internalType: "bytes", name: "ccc", type: "bytes" },
          { internalType: "uint128", name: "ddd", type: "uint128" },
          { internalType: "bytes32", name: "eee", type: "bytes32" }
        ],
        indexed: false,
        internalType: "struct FooTestComposable.Plugh",
        name: "",
        type: "tuple"
      }
    ],
    name: "EmitPlugh",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint128", name: "u", type: "uint128" }
    ],
    name: "EmitUint128",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint16", name: "u", type: "uint16" }
    ],
    name: "EmitUint16",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint256", name: "u", type: "uint256" }
    ],
    name: "EmitUint256",
    type: "event"
  },
  {
    inputs: [
      { internalType: "address", name: "bar", type: "address" },
      { internalType: "bytes32", name: "baz", type: "bytes32" },
      { internalType: "bytes", name: "qux", type: "bytes" },
      { internalType: "uint256", name: "corge", type: "uint256" },
      { internalType: "bytes", name: "waldo", type: "bytes" }
    ],
    name: "foo",
    outputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "bytes32", name: "", type: "bytes32" },
      { internalType: "bytes", name: "", type: "bytes" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bytes", name: "", type: "bytes" }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "address", name: "bar", type: "address" },
      { internalType: "bytes32", name: "baz", type: "bytes32" },
      { internalType: "bytes", name: "qux", type: "bytes" },
      { internalType: "uint256", name: "corge", type: "uint256" },
      { internalType: "bytes", name: "waldo", type: "bytes" },
      { internalType: "uint16", name: "fred", type: "uint16" },
      {
        components: [
          { internalType: "uint256", name: "aaa", type: "uint256" },
          { internalType: "address", name: "bbb", type: "address" },
          { internalType: "bytes", name: "ccc", type: "bytes" },
          { internalType: "uint128", name: "ddd", type: "uint128" },
          { internalType: "bytes32", name: "eee", type: "bytes32" }
        ],
        internalType: "struct FooTestComposable.Plugh",
        name: "plugh",
        type: "tuple"
      }
    ],
    name: "foo2",
    outputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "bytes32", name: "", type: "bytes32" },
      { internalType: "bytes", name: "", type: "bytes" },
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "bytes", name: "", type: "bytes" },
      { internalType: "uint16", name: "", type: "uint16" },
      {
        components: [
          { internalType: "uint256", name: "aaa", type: "uint256" },
          { internalType: "address", name: "bbb", type: "address" },
          { internalType: "bytes", name: "ccc", type: "bytes" },
          { internalType: "uint128", name: "ddd", type: "uint128" },
          { internalType: "bytes32", name: "eee", type: "bytes32" }
        ],
        internalType: "struct FooTestComposable.Plugh",
        name: "",
        type: "tuple"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
]
