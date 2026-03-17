export const COMPOSABILITY_MODULE_ABI_V1_0_0 = [
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

export const COMPOSABILITY_MODULE_ABI_V1_1_0 = [
  {
    type: "constructor",
    inputs: [
      { name: "_defaultEpAddress", type: "address", internalType: "address" }
    ],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "DEFAULT_EP_ADDRESS",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "executeComposable",
    inputs: [
      {
        name: "cExecutions",
        type: "tuple[]",
        internalType: "struct ComposableExecution[]",
        components: [
          { name: "functionSig", type: "bytes4", internalType: "bytes4" },
          {
            name: "inputParams",
            type: "tuple[]",
            internalType: "struct InputParam[]",
            components: [
              {
                name: "paramType",
                type: "uint8",
                internalType: "enum InputParamType"
              },
              {
                name: "fetcherType",
                type: "uint8",
                internalType: "enum InputParamFetcherType"
              },
              { name: "paramData", type: "bytes", internalType: "bytes" },
              {
                name: "constraints",
                type: "tuple[]",
                internalType: "struct Constraint[]",
                components: [
                  {
                    name: "constraintType",
                    type: "uint8",
                    internalType: "enum ConstraintType"
                  },
                  {
                    name: "referenceData",
                    type: "bytes",
                    internalType: "bytes"
                  }
                ]
              }
            ]
          },
          {
            name: "outputParams",
            type: "tuple[]",
            internalType: "struct OutputParam[]",
            components: [
              {
                name: "fetcherType",
                type: "uint8",
                internalType: "enum OutputParamFetcherType"
              },
              { name: "paramData", type: "bytes", internalType: "bytes" }
            ]
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "payable"
  },
  {
    type: "function",
    name: "executeComposableCall",
    inputs: [
      {
        name: "cExecutions",
        type: "tuple[]",
        internalType: "struct ComposableExecution[]",
        components: [
          { name: "functionSig", type: "bytes4", internalType: "bytes4" },
          {
            name: "inputParams",
            type: "tuple[]",
            internalType: "struct InputParam[]",
            components: [
              {
                name: "paramType",
                type: "uint8",
                internalType: "enum InputParamType"
              },
              {
                name: "fetcherType",
                type: "uint8",
                internalType: "enum InputParamFetcherType"
              },
              { name: "paramData", type: "bytes", internalType: "bytes" },
              {
                name: "constraints",
                type: "tuple[]",
                internalType: "struct Constraint[]",
                components: [
                  {
                    name: "constraintType",
                    type: "uint8",
                    internalType: "enum ConstraintType"
                  },
                  {
                    name: "referenceData",
                    type: "bytes",
                    internalType: "bytes"
                  }
                ]
              }
            ]
          },
          {
            name: "outputParams",
            type: "tuple[]",
            internalType: "struct OutputParam[]",
            components: [
              {
                name: "fetcherType",
                type: "uint8",
                internalType: "enum OutputParamFetcherType"
              },
              { name: "paramData", type: "bytes", internalType: "bytes" }
            ]
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "executeComposableDelegateCall",
    inputs: [
      {
        name: "cExecutions",
        type: "tuple[]",
        internalType: "struct ComposableExecution[]",
        components: [
          { name: "functionSig", type: "bytes4", internalType: "bytes4" },
          {
            name: "inputParams",
            type: "tuple[]",
            internalType: "struct InputParam[]",
            components: [
              {
                name: "paramType",
                type: "uint8",
                internalType: "enum InputParamType"
              },
              {
                name: "fetcherType",
                type: "uint8",
                internalType: "enum InputParamFetcherType"
              },
              { name: "paramData", type: "bytes", internalType: "bytes" },
              {
                name: "constraints",
                type: "tuple[]",
                internalType: "struct Constraint[]",
                components: [
                  {
                    name: "constraintType",
                    type: "uint8",
                    internalType: "enum ConstraintType"
                  },
                  {
                    name: "referenceData",
                    type: "bytes",
                    internalType: "bytes"
                  }
                ]
              }
            ]
          },
          {
            name: "outputParams",
            type: "tuple[]",
            internalType: "struct OutputParam[]",
            components: [
              {
                name: "fetcherType",
                type: "uint8",
                internalType: "enum OutputParamFetcherType"
              },
              { name: "paramData", type: "bytes", internalType: "bytes" }
            ]
          }
        ]
      }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getEntryPoint",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isInitialized",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isModuleType",
    inputs: [
      { name: "moduleTypeId", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "onInstall",
    inputs: [{ name: "data", type: "bytes", internalType: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "onUninstall",
    inputs: [{ name: "data", type: "bytes", internalType: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setEntryPoint",
    inputs: [{ name: "_entryPoint", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "error",
    name: "AlreadyInitialized",
    inputs: [{ name: "smartAccount", type: "address", internalType: "address" }]
  },
  { type: "error", name: "ComposableExecutionFailed", inputs: [] },
  {
    type: "error",
    name: "ConstraintNotMet",
    inputs: [
      {
        name: "constraintType",
        type: "uint8",
        internalType: "enum ConstraintType"
      }
    ]
  },
  { type: "error", name: "DelegateCallOnly", inputs: [] },
  { type: "error", name: "FailedToReturnMsgValue", inputs: [] },
  { type: "error", name: "InvalidConstraintType", inputs: [] },
  { type: "error", name: "InvalidOutputParamFetcherType", inputs: [] },
  {
    type: "error",
    name: "InvalidParameterEncoding",
    inputs: [{ name: "message", type: "string", internalType: "string" }]
  },
  {
    type: "error",
    name: "NotInitialized",
    inputs: [{ name: "smartAccount", type: "address", internalType: "address" }]
  },
  { type: "error", name: "OnlyEntryPointOrAccount", inputs: [] },
  { type: "error", name: "Output_StaticCallFailed", inputs: [] },
  { type: "error", name: "ZeroAddressNotAllowed", inputs: [] }
]
