export const COMPOSABILITY_MODULE_ABI = [
  {
    type: "function",
    name: "executeComposable",
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        name: "value",
        type: "uint256",
        internalType: "uint256"
      },
      {
        name: "functionSig",
        type: "bytes4",
        internalType: "bytes4"
      },
      {
        name: "inputParams",
        type: "tuple[]",
        internalType: "struct ComposableFallbackHandler.InputParam[]",
        components: [
          {
            name: "fetcherType",
            type: "uint8",
            internalType: "enum ComposableFallbackHandler.InputParamFetcherType"
          },
          {
            name: "valueType",
            type: "uint8",
            internalType: "enum ComposableFallbackHandler.ParamValueType"
          },
          {
            name: "paramData",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      },
      {
        name: "outputParams",
        type: "tuple[]",
        internalType: "struct ComposableFallbackHandler.OutputParam[]",
        components: [
          {
            name: "fetcherType",
            type: "uint8",
            internalType:
              "enum ComposableFallbackHandler.OutputParamFetcherType"
          },
          {
            name: "valueType",
            type: "uint8",
            internalType: "enum ComposableFallbackHandler.ParamValueType"
          },
          {
            name: "paramData",
            type: "bytes",
            internalType: "bytes"
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "isInitialized",
    inputs: [
      {
        name: "",
        type: "address",
        internalType: "address"
      }
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isModuleType",
    inputs: [
      {
        name: "moduleTypeId",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "onInstall",
    inputs: [
      {
        name: "data",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "onUninstall",
    inputs: [
      {
        name: "data",
        type: "bytes",
        internalType: "bytes"
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "error",
    name: "AlreadyInitialized",
    inputs: [
      {
        name: "smartAccount",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "ExecutionFailed",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidComposerInstructions",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidOutputParamFetcherType",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidParameterEncoding",
    inputs: []
  },
  {
    type: "error",
    name: "InvalidReturnDataHandling",
    inputs: []
  },
  {
    type: "error",
    name: "ModuleAlreadyInitialized",
    inputs: []
  },
  {
    type: "error",
    name: "NotInitialized",
    inputs: [
      {
        name: "smartAccount",
        type: "address",
        internalType: "address"
      }
    ]
  },
  {
    type: "error",
    name: "StorageReadFailed",
    inputs: []
  }
]
