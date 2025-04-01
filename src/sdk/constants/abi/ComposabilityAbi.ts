export const COMPOSABILITY_MODULE_ABI = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  {
    inputs: [
      { internalType: "address", name: "smartAccount", type: "address" }
    ],
    name: "AlreadyInitialized",
    type: "error"
  },
  { inputs: [], name: "ComposableExecutionFailed", type: "error" },
  {
    inputs: [
      {
        internalType: "enum ConstraintType",
        name: "constraintType",
        type: "uint8"
      }
    ],
    name: "ConstraintNotMet",
    type: "error"
  },
  { inputs: [], name: "FailedToReturnMsgValue", type: "error" },
  { inputs: [], name: "InvalidConstraintType", type: "error" },
  { inputs: [], name: "InvalidOutputParamFetcherType", type: "error" },
  { inputs: [], name: "InvalidParameterEncoding", type: "error" },
  {
    inputs: [
      { internalType: "address", name: "smartAccount", type: "address" }
    ],
    name: "NotInitialized",
    type: "error"
  },
  { inputs: [], name: "OnlyEntryPointOrAccount", type: "error" },
  { inputs: [], name: "Output_StaticCallFailed", type: "error" },
  { inputs: [], name: "ZeroAddressNotAllowed", type: "error" },
  {
    inputs: [],
    name: "ENTRY_POINT_V07_ADDRESS",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "bytes4", name: "functionSig", type: "bytes4" },
          {
            components: [
              {
                internalType: "enum InputParamFetcherType",
                name: "fetcherType",
                type: "uint8"
              },
              { internalType: "bytes", name: "paramData", type: "bytes" },
              {
                components: [
                  {
                    internalType: "enum ConstraintType",
                    name: "constraintType",
                    type: "uint8"
                  },
                  {
                    internalType: "bytes",
                    name: "referenceData",
                    type: "bytes"
                  }
                ],
                internalType: "struct Constraint[]",
                name: "constraints",
                type: "tuple[]"
              }
            ],
            internalType: "struct InputParam[]",
            name: "inputParams",
            type: "tuple[]"
          },
          {
            components: [
              {
                internalType: "enum OutputParamFetcherType",
                name: "fetcherType",
                type: "uint8"
              },
              { internalType: "bytes", name: "paramData", type: "bytes" }
            ],
            internalType: "struct OutputParam[]",
            name: "outputParams",
            type: "tuple[]"
          }
        ],
        internalType: "struct ComposableExecution[]",
        name: "executions",
        type: "tuple[]"
      }
    ],
    name: "executeComposable",
    outputs: [],
    stateMutability: "payable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "bytes4", name: "functionSig", type: "bytes4" },
          {
            components: [
              {
                internalType: "enum InputParamFetcherType",
                name: "fetcherType",
                type: "uint8"
              },
              { internalType: "bytes", name: "paramData", type: "bytes" },
              {
                components: [
                  {
                    internalType: "enum ConstraintType",
                    name: "constraintType",
                    type: "uint8"
                  },
                  {
                    internalType: "bytes",
                    name: "referenceData",
                    type: "bytes"
                  }
                ],
                internalType: "struct Constraint[]",
                name: "constraints",
                type: "tuple[]"
              }
            ],
            internalType: "struct InputParam[]",
            name: "inputParams",
            type: "tuple[]"
          },
          {
            components: [
              {
                internalType: "enum OutputParamFetcherType",
                name: "fetcherType",
                type: "uint8"
              },
              { internalType: "bytes", name: "paramData", type: "bytes" }
            ],
            internalType: "struct OutputParam[]",
            name: "outputParams",
            type: "tuple[]"
          }
        ],
        internalType: "struct ComposableExecution[]",
        name: "executions",
        type: "tuple[]"
      }
    ],
    name: "executeComposableCall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "to", type: "address" },
          { internalType: "uint256", name: "value", type: "uint256" },
          { internalType: "bytes4", name: "functionSig", type: "bytes4" },
          {
            components: [
              {
                internalType: "enum InputParamFetcherType",
                name: "fetcherType",
                type: "uint8"
              },
              { internalType: "bytes", name: "paramData", type: "bytes" },
              {
                components: [
                  {
                    internalType: "enum ConstraintType",
                    name: "constraintType",
                    type: "uint8"
                  },
                  {
                    internalType: "bytes",
                    name: "referenceData",
                    type: "bytes"
                  }
                ],
                internalType: "struct Constraint[]",
                name: "constraints",
                type: "tuple[]"
              }
            ],
            internalType: "struct InputParam[]",
            name: "inputParams",
            type: "tuple[]"
          },
          {
            components: [
              {
                internalType: "enum OutputParamFetcherType",
                name: "fetcherType",
                type: "uint8"
              },
              { internalType: "bytes", name: "paramData", type: "bytes" }
            ],
            internalType: "struct OutputParam[]",
            name: "outputParams",
            type: "tuple[]"
          }
        ],
        internalType: "struct ComposableExecution[]",
        name: "executions",
        type: "tuple[]"
      }
    ],
    name: "executeComposableDelegateCall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getEntryPoint",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "isInitialized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { internalType: "uint256", name: "moduleTypeId", type: "uint256" }
    ],
    name: "isModuleType",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes", name: "data", type: "bytes" }],
    name: "onInstall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "bytes", name: "data", type: "bytes" }],
    name: "onUninstall",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "_entryPoint", type: "address" }],
    name: "setEntryPoint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
]
